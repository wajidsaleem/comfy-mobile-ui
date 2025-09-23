import axios from 'axios';

const REGISTRY_BASE_URL = 'https://api.comfy.org/nodes';

export interface RegistryNodeVersion {
  version: string;
  created_at?: string;
  channel?: string;
}

export interface RegistryNodeDetail {
  id: string;
  name: string;
  description?: string;
  author?: string;
  repository?: string;
  latest_version?: RegistryNodeVersion;
  downloads?: number;
  stars?: number;
}

export async function fetchRegistryNodeByType(nodeType: string): Promise<RegistryNodeDetail | null> {
  try {
    const response = await axios.get(
      `${REGISTRY_BASE_URL}/${encodeURIComponent(nodeType)}`,
      {
        timeout: 10000,
        validateStatus: (status) => status === 200 || status === 404,
      },
    );

    if (response.status === 404) {
      return null;
    }

    return response.data as RegistryNodeDetail;
  } catch (error) {
    console.warn('Failed to fetch registry node info:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function fetchRegistryNodeVersions(packId: string): Promise<RegistryNodeVersion[]> {
  try {
    const response = await axios.get(
      `${REGISTRY_BASE_URL}/${encodeURIComponent(packId)}/versions`,
      {
        timeout: 10000,
      },
    );
    return Array.isArray(response.data) ? (response.data as RegistryNodeVersion[]) : [];
  } catch (error) {
    console.warn('Failed to fetch registry node versions:', error instanceof Error ? error.message : error);
    return [];
  }
}

export async function fetchRegistryNodesBulk(nodeIds: string[]): Promise<RegistryNodeDetail[]> {
  if (!nodeIds.length) {
    return [];
  }

  const params = new URLSearchParams();
  nodeIds.forEach((id) => {
    if (id) {
      params.append('node_id', id);
    }
  });
  if (!params.has('node_id')) {
    return [];
  }
  params.set('limit', Math.max(nodeIds.length, 50).toString());

  try {
    const response = await axios.get(`${REGISTRY_BASE_URL}?${params.toString()}`, {
      timeout: 10000,
    });
    const data = response.data as { nodes?: RegistryNodeDetail[] } | RegistryNodeDetail[];
    if (Array.isArray(data)) {
      return data;
    }
    if (Array.isArray(data?.nodes)) {
      return data.nodes;
    }
    return [];
  } catch (error) {
    console.warn('Failed to fetch registry nodes:', error instanceof Error ? error.message : error);
    return [];
  }
}
