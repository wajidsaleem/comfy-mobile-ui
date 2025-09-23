import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2, PlugZap, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MANAGER_QUEUE_EVENT,
  MissingNodePackage,
  MissingWorkflowNode,
  ManagerQueueStatus,
  PackageInstallSelection,
  parseManagerQueueStatus,
  queueMissingNodeInstallation,
  resolveMissingNodePackages,
} from '@/services/MissingNodesService';
import { globalWebSocketService } from '@/infrastructure/websocket/GlobalWebSocketService';
import ComfyUIService from '@/infrastructure/api/ComfyApiClient';

interface MissingNodeInstallerModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingNodes: MissingWorkflowNode[];
  onInstallationComplete?: (queuedCount: number) => void;
}

interface PackageRowState {
  selectedVersion: string;
  isInstalling: boolean;
}

const glassPanelClass = 'bg-white/20 dark:bg-slate-800/20 backdrop-blur-xl border border-white/20 dark:border-slate-600/20 rounded-3xl shadow-2xl shadow-slate-900/20 dark:shadow-slate-900/40';

export const MissingNodeInstallerModal: React.FC<MissingNodeInstallerModalProps> = ({
  isOpen,
  onClose,
  missingNodes,
  onInstallationComplete,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [packages, setPackages] = useState<MissingNodePackage[]>([]);
  const [rowState, setRowState] = useState<Record<string, PackageRowState>>({});
  const [error, setError] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState<ManagerQueueStatus | null>(null);
  const [showRebootPrompt, setShowRebootPrompt] = useState(false);
  const pendingInstallCountRef = useRef(0);
  const pendingInstallIdsRef = useRef<Set<string>>(new Set());

  const installablePackages = useMemo(
    () => packages.filter((pkg) => pkg.isInstallable),
    [packages],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    const loadPackages = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const resolved = await resolveMissingNodePackages(missingNodes);
        if (cancelled) return;
        setPackages(resolved);
        const nextRowState: Record<string, PackageRowState> = {};
        resolved.forEach((pkg) => {
          const defaultVersion = pkg.availableVersions[0] ?? 'latest';
          nextRowState[pkg.packId] = {
            selectedVersion: defaultVersion,
            isInstalling: false,
          };
        });
        setRowState(nextRowState);
      } catch (err) {
        console.error('Failed to resolve missing node packages:', err);
        if (!cancelled) {
          setError('Failed to resolve missing node packages. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadPackages();

    return () => {
      cancelled = true;
      setQueueStatus(null);
      setShowRebootPrompt(false);
      pendingInstallCountRef.current = 0;
      pendingInstallIdsRef.current.clear();
    };
  }, [isOpen, missingNodes]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handler = (event: any) => {
      const status = parseManagerQueueStatus(event?.data ?? event);
      if (!status) {
        return;
      }
      setQueueStatus(status);
      if (status.status === 'done') {
        setRowState((prev) => {
          const next: Record<string, PackageRowState> = {};
          Object.entries(prev).forEach(([key, value]) => {
            next[key] = { ...value, isInstalling: false };
          });
          return next;
        });
        setShowRebootPrompt(true);
        toast.success('Missing node packages installed successfully');

        if (pendingInstallIdsRef.current.size > 0) {
          setPackages((prev) => prev.map((pkg) => (
            pendingInstallIdsRef.current.has(pkg.packId)
              ? { ...pkg, isInstallable: false, isInstalled: true }
              : pkg
          )));
        }

        const completedCount = pendingInstallCountRef.current
          ? pendingInstallCountRef.current
          : pendingInstallIdsRef.current.size || installablePackages.length;

        pendingInstallCountRef.current = 0;
        pendingInstallIdsRef.current.clear();

        if (completedCount > 0) {
          onInstallationComplete?.(completedCount);
        }
      }
    };

    const listenerId = globalWebSocketService.on(MANAGER_QUEUE_EVENT, handler);

    return () => {
      if (listenerId) {
        globalWebSocketService.offById(MANAGER_QUEUE_EVENT, listenerId);
      }
      globalWebSocketService.off(MANAGER_QUEUE_EVENT, handler);
    };
  }, [isOpen, onInstallationComplete, installablePackages.length]);

  const handleVersionChange = (packId: string, version: string) => {
    setRowState((prev) => ({
      ...prev,
      [packId]: {
        ...(prev[packId] ?? { selectedVersion: version, isInstalling: false }),
        selectedVersion: version,
      },
    }));
  };

  const handleInstallPackage = async (pkg: MissingNodePackage) => {
    if (!pkg.isInstallable) {
      toast.error('This package could not be resolved automatically.');
      return;
    }

    const selection: PackageInstallSelection = {
      packId: pkg.packId,
      selectedVersion: rowState[pkg.packId]?.selectedVersion ?? pkg.availableVersions[0] ?? 'latest',
      repository: pkg.repository,
      channel: pkg.channel,
      mode: pkg.mode,
      files: pkg.files,
      installType: pkg.installType,
    };

    setRowState((prev) => ({
      ...prev,
      [pkg.packId]: {
        ...(prev[pkg.packId] ?? { selectedVersion: selection.selectedVersion, isInstalling: false }),
        isInstalling: true,
      },
    }));

    const success = await queueMissingNodeInstallation([selection]);

    if (!success) {
      toast.error(`Failed to queue installation for ${pkg.packName ?? pkg.packId}`);
      setRowState((prev) => ({
        ...prev,
        [pkg.packId]: {
          ...(prev[pkg.packId] ?? { selectedVersion: selection.selectedVersion, isInstalling: false }),
          isInstalling: false,
        },
      }));
    } else {
      toast.info('Installation queued. Monitoring progress...');
      pendingInstallCountRef.current += 1;
      pendingInstallIdsRef.current.add(pkg.packId);
    }
  };

  const handleInstallAll = async () => {
    const selections: PackageInstallSelection[] = installablePackages.map((pkg) => ({
      packId: pkg.packId,
      selectedVersion: rowState[pkg.packId]?.selectedVersion ?? pkg.availableVersions[0] ?? 'latest',
      repository: pkg.repository,
      channel: pkg.channel,
      mode: pkg.mode,
      files: pkg.files,
      installType: pkg.installType,
    }));

    if (!selections.length) {
      toast.error('No installable packages detected.');
      return;
    }

    const nextRowState: Record<string, PackageRowState> = { ...rowState };
    selections.forEach((selection) => {
      nextRowState[selection.packId] = {
        ...(nextRowState[selection.packId] ?? { selectedVersion: selection.selectedVersion, isInstalling: false }),
        isInstalling: true,
      };
    });
    setRowState(nextRowState);

    const success = await queueMissingNodeInstallation(selections);

    if (!success) {
      toast.error('Failed to queue one or more package installations');
      setRowState((prev) => {
        const reset: Record<string, PackageRowState> = { ...prev };
        selections.forEach((selection) => {
          reset[selection.packId] = {
            ...(reset[selection.packId] ?? { selectedVersion: selection.selectedVersion, isInstalling: false }),
            isInstalling: false,
          };
        });
        return reset;
      });
    } else {
      toast.info('All selected packages queued for installation.');
      pendingInstallCountRef.current += selections.length;
      selections.forEach((selection) => pendingInstallIdsRef.current.add(selection.packId));
    }
  };

  const handleRebootServer = async () => {
    const rebooted = await ComfyUIService.rebootServer();
    if (rebooted) {
      toast.success('Server reboot requested. Please wait for ComfyUI to restart.');
      setShowRebootPrompt(false);
      onClose();
    } else {
      toast.error('Failed to trigger server reboot.');
    }
  };

  const renderPackageCard = (pkg: MissingNodePackage) => {
    const state = rowState[pkg.packId] ?? { selectedVersion: pkg.availableVersions[0] ?? 'latest', isInstalling: false };
    const actionLabel = pkg.isInstalled ? 'Update' : 'Install';
    const badgeVariant = pkg.isInstalled ? 'secondary' : 'outline';

    return (
      <div key={pkg.packId} className={`${glassPanelClass} p-5 space-y-4`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {pkg.packName ?? pkg.packId}
              </h3>
              <Badge variant={badgeVariant} className="uppercase tracking-wide text-xs">
                {pkg.isInstalled ? 'Installed' : 'Missing'}
              </Badge>
              {pkg.isUpdateAvailable && (
                <Badge variant="destructive" className="uppercase tracking-wide text-xs">
                  Update available
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 break-all">{pkg.packId}</p>
            {pkg.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {pkg.description}
              </p>
            )}
            <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
              <span>Source: {pkg.source}</span>
              {pkg.repository && <span>Repository: {pkg.repository}</span>}
              {pkg.latestVersion && <span>Latest: {pkg.latestVersion}</span>}
              {pkg.installedVersion && <span>Installed: {pkg.installedVersion}</span>}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Missing nodes: {pkg.nodeTypes.join(', ')}
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-3 md:min-w-[220px]">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Version
              </label>
              <Select
                value={state.selectedVersion}
                onValueChange={(value) => handleVersionChange(pkg.packId, value)}
                disabled={!pkg.isInstallable || state.isInstalling}
              >
                <SelectTrigger className="h-11 rounded-xl border-white/30 dark:border-slate-700/40 bg-white/40 dark:bg-slate-900/40 text-sm">
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent className="z-[120] backdrop-blur-xl bg-white/70 dark:bg-slate-900/80 border border-white/30 dark:border-slate-700/40">
                  {pkg.availableVersions.map((version) => (
                    <SelectItem key={version} value={version} className="text-sm">
                      {version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              className="h-11 rounded-xl border border-slate-200/60 dark:border-slate-700/60 hover:bg-white/40 dark:hover:bg-slate-800/40"
              disabled={!pkg.isInstallable || state.isInstalling}
              onClick={() => handleInstallPackage(pkg)}
            >
              {state.isInstalling ? (
                <span className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Queued...
                </span>
              ) : (
                <span className="flex items-center gap-2 text-sm">
                  <PlugZap className="h-4 w-4" /> {actionLabel}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-900/40 via-blue-900/20 to-purple-900/40 backdrop-blur-md pwa-modal"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pwa-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`relative w-full max-w-3xl ${glassPanelClass} overflow-hidden`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-slate-900/10 pointer-events-none" />

              <div className="relative flex items-center justify-between px-6 py-5 bg-white/10 dark:bg-slate-700/10 backdrop-blur-sm border-b border-white/10 dark:border-slate-600/10">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    Install Missing Nodes
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Resolve missing packages detected in this workflow.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 p-0 hover:bg-white/20 dark:hover:bg-slate-700/30 text-slate-700 dark:text-slate-200 backdrop-blur-sm border border-white/10 dark:border-slate-600/10 rounded-full"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="relative max-h-[70vh] overflow-y-auto px-6 py-5 space-y-4">
                {isLoading && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-600 dark:text-slate-300">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="mt-3 text-sm">Loading package information...</p>
                  </div>
                )}

                {!isLoading && error && (
                  <div className="rounded-2xl border border-red-200/40 bg-red-500/10 px-4 py-4 text-sm text-red-600 backdrop-blur-sm dark:border-red-500/30 dark:text-red-400">
                    {error}
                  </div>
                )}

                {!isLoading && !error && packages.length === 0 && (
                  <div className="rounded-2xl border border-white/20 bg-white/10 px-6 py-6 text-center text-sm text-slate-600 backdrop-blur-sm dark:border-slate-600/20 dark:bg-slate-700/10 dark:text-slate-300">
                    All required nodes are available on the server.
                  </div>
                )}

                {!isLoading && !error && packages.length > 0 && (
                  <div className="space-y-4">
                    {packages.map(renderPackageCard)}
                  </div>
                )}
              </div>

              <div className="relative flex flex-col gap-3 border-t border-white/10 px-6 py-4 backdrop-blur-sm dark:border-slate-600/10 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {queueStatus ? (
                    queueStatus.status === 'in_progress' ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Installing packages...
                        {typeof queueStatus.doneCount === 'number' && typeof queueStatus.totalCount === 'number' && (
                          <span>
                            {queueStatus.doneCount}/{queueStatus.totalCount} completed
                          </span>
                        )}
                      </span>
                    ) : (
                      <span>Installation queue completed.</span>
                    )
                  ) : (
                    <span>Select a package to install or update.</span>
                  )}
                </div>
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl border border-white/30 bg-white/10 text-slate-700 backdrop-blur-sm transition-colors hover:bg-white/20 dark:border-slate-600/30 dark:bg-slate-800/20 dark:text-slate-200 dark:hover:bg-slate-700/20"
                    onClick={handleInstallAll}
                    disabled={
                      installablePackages.length === 0 ||
                      installablePackages.every((pkg) => rowState[pkg.packId]?.isInstalling)
                    }
                  >
                    <span className="flex items-center gap-2">
                      <PlugZap className="h-4 w-4" /> Install All
                    </span>
                  </Button>
                  {showRebootPrompt && (
                    <Button
                      variant="outline"
                      className="h-11 rounded-xl border border-white/30 bg-white/10 text-slate-700 backdrop-blur-sm transition-colors hover:bg-white/20 dark:border-slate-600/30 dark:bg-slate-800/20 dark:text-slate-200 dark:hover:bg-slate-700/20"
                      onClick={handleRebootServer}
                    >
                      <span className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4" /> Reboot Server
                      </span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MissingNodeInstallerModal;



