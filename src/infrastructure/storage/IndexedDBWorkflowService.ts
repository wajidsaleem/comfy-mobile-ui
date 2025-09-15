/**
 * IndexedDBWorkflowService - High-capacity workflow storage using IndexedDB
 * 
 * Provides the same API as WorkflowStorageService but with much higher capacity:
 * - localStorage: ~5-10MB
 * - IndexedDB: Up to 50% of disk space (several GB)
 * 
 * Features:
 * - Async operations (non-blocking UI)
 * - Structured data with indexing
 * - Better performance for large datasets
 * - Full mobile browser support
 */

import type { Workflow } from '@/shared/types/app/IComfyWorkflow'

const DB_NAME = 'ComfyMobileUI'
const DB_VERSION = 3 // Updated to support sortOrder field
const STORE_NAME = 'workflows'

interface DBWorkflow {
  id: string
  name: string
  description?: string
  workflow_json: any
  nodeCount?: number
  createdAt: string
  modifiedAt?: string
  author?: string
  tags?: string[]
  thumbnail?: string
  isValid?: boolean
  sortOrder?: number
}

class IndexedDBWorkflowService {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  /**
   * Initialize IndexedDB connection
   */
  private async init(): Promise<void> {
    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`))
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('✅ IndexedDB connected successfully')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Create workflows object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          
          // Create indexes for faster queries
          store.createIndex('name', 'name', { unique: false })
          store.createIndex('createdAt', 'createdAt', { unique: false })
          store.createIndex('modifiedAt', 'modifiedAt', { unique: false })
          store.createIndex('author', 'author', { unique: false })
          store.createIndex('tags', 'tags', { unique: false, multiEntry: true })
          store.createIndex('sortOrder', 'sortOrder', { unique: false })
          
          console.log('✅ IndexedDB workflows object store created with indexes')
        } else if (event.oldVersion < 3) {
          // Add sortOrder index to existing store
          const transaction = (event.target as IDBOpenDBRequest).transaction!
          const store = transaction.objectStore(STORE_NAME)
          
          if (!store.indexNames.contains('sortOrder')) {
            store.createIndex('sortOrder', 'sortOrder', { unique: false })
            console.log('✅ Added sortOrder index to existing workflows store')
          }
        }
        
        // Create API keys object store if it doesn't exist (for compatibility with ApiKeyStorageService)
        if (!db.objectStoreNames.contains('apiKeys')) {
          const apiKeyStore = db.createObjectStore('apiKeys', { keyPath: 'id' })
          apiKeyStore.createIndex('provider', 'provider', { unique: false })
          apiKeyStore.createIndex('isActive', 'isActive', { unique: false })
          console.log('✅ IndexedDB apiKeys object store created')
        }
      }
    })

    return this.initPromise
  }

  /**
   * Get a transaction for the workflows store
   */
  private async getTransaction(mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    await this.init()
    if (!this.db) {
      throw new Error('IndexedDB not initialized')
    }
    
    const transaction = this.db.transaction([STORE_NAME], mode)
    return transaction.objectStore(STORE_NAME)
  }

  /**
   * Convert Workflow to DB format
   */
  private workflowToDBFormat(workflow: Workflow): DBWorkflow {
    // Deep clone to ensure we don't have any non-serializable objects
    const clonedWorkflowJson = this.deepCloneSerializable(workflow.workflow_json)
    
    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      workflow_json: clonedWorkflowJson,
      nodeCount: workflow.nodeCount,
      createdAt: workflow.createdAt?.toISOString() || new Date().toISOString(),
      modifiedAt: workflow.modifiedAt?.toISOString(),
      author: workflow.author,
      tags: workflow.tags,
      thumbnail: workflow.thumbnail,
      isValid: workflow.isValid,
      sortOrder: workflow.sortOrder
    }
  }

  /**
   * Deep clone only serializable properties
   */
  private deepCloneSerializable(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime())
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepCloneSerializable(item))
    }

    // For objects, only clone enumerable properties (skip prototype methods)
    const cloned: any = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        try {
          cloned[key] = this.deepCloneSerializable(obj[key])
        } catch (error) {
          // Skip properties that can't be serialized
          console.warn(`Skipping non-serializable property: ${key}`)
        }
      }
    }
    return cloned
  }

  /**
   * Convert DB format to Workflow
   */
  private dbFormatToWorkflow(dbWorkflow: DBWorkflow): Workflow {
    return {
      ...dbWorkflow,
      createdAt: new Date(dbWorkflow.createdAt),
      modifiedAt: dbWorkflow.modifiedAt ? new Date(dbWorkflow.modifiedAt) : undefined,
      isValid: dbWorkflow.isValid !== false, // Default to true if not specified
      nodeCount: dbWorkflow.nodeCount || 0, // Default to 0 if not specified
      sortOrder: dbWorkflow.sortOrder
    }
  }

  /**
   * Load all workflows from IndexedDB
   */
  async loadAllWorkflows(): Promise<Workflow[]> {
    try {
      const store = await this.getTransaction('readonly')
      
      return new Promise((resolve, reject) => {
        const request = store.getAll()
        
        request.onsuccess = () => {
          const dbWorkflows = request.result as DBWorkflow[]
          const workflows = dbWorkflows
            .map(this.dbFormatToWorkflow)
            .sort((a, b) => {
              // First sort by sortOrder if both have it
              if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
                // If sortOrder is the same, sort by creation date (newest first)
                if (a.sortOrder === b.sortOrder) {
                  return b.createdAt.getTime() - a.createdAt.getTime()
                }
                return a.sortOrder - b.sortOrder
              }
              // If only one has sortOrder, prioritize it
              if (a.sortOrder !== undefined && b.sortOrder === undefined) {
                return -1
              }
              if (a.sortOrder === undefined && b.sortOrder !== undefined) {
                return 1
              }
              // If neither has sortOrder, fall back to creation date (newest first)
              return b.createdAt.getTime() - a.createdAt.getTime()
            })
          
          resolve(workflows)
        }
        
        request.onerror = () => {
          reject(new Error(`Failed to load workflows: ${request.error?.message}`))
        }
      })
    } catch (error) {
      console.error('Failed to load workflows from IndexedDB:', error)
      throw error
    }
  }

  /**
   * Save all workflows to IndexedDB (batch operation)
   */
  async saveAllWorkflows(workflows: Workflow[]): Promise<void> {
    try {
      const store = await this.getTransaction('readwrite')
      
      // Clear existing data
      await new Promise<void>((resolve, reject) => {
        const clearRequest = store.clear()
        clearRequest.onsuccess = () => resolve()
        clearRequest.onerror = () => reject(new Error(`Failed to clear workflows: ${clearRequest.error?.message}`))
      })
      
      // Assign sortOrder based on array position if not already set
      const workflowsWithSortOrder = workflows.map((workflow, index) => ({
        ...workflow,
        sortOrder: workflow.sortOrder !== undefined ? workflow.sortOrder : index
      }))
      
      // Add all workflows
      await Promise.all(workflowsWithSortOrder.map(workflow => {
        return new Promise<void>((resolve, reject) => {
          const addRequest = store.add(this.workflowToDBFormat(workflow))
          addRequest.onsuccess = () => resolve()
          addRequest.onerror = () => reject(new Error(`Failed to save workflow ${workflow.id}: ${addRequest.error?.message}`))
        })
      }))
      
      console.log(`✅ Saved ${workflows.length} workflows to IndexedDB with sort order`)
    } catch (error) {
      console.error('Failed to save workflows to IndexedDB:', error)
      throw error
    }
  }

  /**
   * Add new workflow to IndexedDB
   */
  async addWorkflow(workflow: Workflow): Promise<void> {
    try {
      const store = await this.getTransaction('readwrite')
      
      // If no sortOrder is set, new workflows get sortOrder = 0 (will be at top)
      if (workflow.sortOrder === undefined) {
        workflow.sortOrder = 0
      }
      
      return new Promise((resolve, reject) => {
        const request = store.add(this.workflowToDBFormat(workflow))
        
        request.onsuccess = () => {
          console.log(`✅ Added workflow ${workflow.name} to IndexedDB with sortOrder ${workflow.sortOrder}`)
          resolve()
        }
        
        request.onerror = () => {
          reject(new Error(`Failed to add workflow: ${request.error?.message}`))
        }
      })
    } catch (error) {
      console.error('Failed to add workflow to IndexedDB:', error)
      throw error
    }
  }

  /**
   * Update existing workflow in IndexedDB
   */
  async updateWorkflow(workflow: Workflow): Promise<void> {
    try {
      const store = await this.getTransaction('readwrite')
      
      const workflowToUpdate = {
        ...this.workflowToDBFormat(workflow),
        modifiedAt: new Date().toISOString()
      }
      
      return new Promise((resolve, reject) => {
        const request = store.put(workflowToUpdate)
        
        request.onsuccess = () => {
          console.log(`✅ Updated workflow ${workflow.name} in IndexedDB`)
          resolve()
        }
        
        request.onerror = () => {
          reject(new Error(`Failed to update workflow: ${request.error?.message}`))
        }
      })
    } catch (error) {
      console.error('Failed to update workflow in IndexedDB:', error)
      throw error
    }
  }

  /**
   * Remove workflow from IndexedDB
   */
  async removeWorkflow(workflowId: string): Promise<void> {
    try {
      const store = await this.getTransaction('readwrite')
      
      return new Promise((resolve, reject) => {
        const request = store.delete(workflowId)
        
        request.onsuccess = () => {
          console.log(`✅ Removed workflow ${workflowId} from IndexedDB`)
          resolve()
        }
        
        request.onerror = () => {
          reject(new Error(`Failed to remove workflow: ${request.error?.message}`))
        }
      })
    } catch (error) {
      console.error('Failed to remove workflow from IndexedDB:', error)
      throw error
    }
  }

  /**
   * Find workflow by ID
   */
  async findWorkflowById(workflowId: string): Promise<Workflow | null> {
    try {
      const store = await this.getTransaction('readonly')
      
      return new Promise((resolve, reject) => {
        const request = store.get(workflowId)
        
        request.onsuccess = () => {
          const dbWorkflow = request.result as DBWorkflow | undefined
          resolve(dbWorkflow ? this.dbFormatToWorkflow(dbWorkflow) : null)
        }
        
        request.onerror = () => {
          reject(new Error(`Failed to find workflow: ${request.error?.message}`))
        }
      })
    } catch (error) {
      console.error('Failed to find workflow in IndexedDB:', error)
      return null
    }
  }

  /**
   * Check if workflow exists
   */
  async workflowExists(workflowId: string): Promise<boolean> {
    const workflow = await this.findWorkflowById(workflowId)
    return workflow !== null
  }

  /**
   * Get storage statistics
   */
  async getWorkflowStats(): Promise<{
    totalCount: number
    totalSize: number
    averageNodes: number
    oldestWorkflow?: Date
    newestWorkflow?: Date
  }> {
    try {
      const workflows = await this.loadAllWorkflows()
      
      if (workflows.length === 0) {
        return {
          totalCount: 0,
          totalSize: 0,
          averageNodes: 0
        }
      }

      const totalNodes = workflows.reduce((sum, w) => sum + (w.nodeCount || 0), 0)
      const dates = workflows.map(w => w.createdAt).sort((a, b) => a.getTime() - b.getTime())
      
      // Estimate storage size (more accurate than localStorage blob method)
      const totalSize = await this.getStorageSize()

      return {
        totalCount: workflows.length,
        totalSize,
        averageNodes: Math.round(totalNodes / workflows.length),
        oldestWorkflow: dates[0],
        newestWorkflow: dates[dates.length - 1]
      }
    } catch (error) {
      console.error('Failed to get workflow stats:', error)
      return {
        totalCount: 0,
        totalSize: 0,
        averageNodes: 0
      }
    }
  }

  /**
   * Get storage size (more accurate than localStorage)
   */
  async getStorageSize(): Promise<number> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        return estimate.usage || 0
      }
      
      // Fallback: estimate based on workflow count and average size
      const workflows = await this.loadAllWorkflows()
      return workflows.length * 100 * 1024 // Estimate 100KB per workflow
    } catch (error) {
      console.error('Failed to get storage size:', error)
      return 0
    }
  }

  /**
   * Clear all workflows from IndexedDB
   */
  async clearAllWorkflows(): Promise<void> {
    try {
      const store = await this.getTransaction('readwrite')
      
      return new Promise((resolve, reject) => {
        const request = store.clear()
        
        request.onsuccess = () => {
          console.log('✅ Cleared all workflows from IndexedDB')
          resolve()
        }
        
        request.onerror = () => {
          reject(new Error(`Failed to clear workflows: ${request.error?.message}`))
        }
      })
    } catch (error) {
      console.error('Failed to clear workflows from IndexedDB:', error)
      throw error
    }
  }

  /**
   * Export workflows as JSON
   */
  async exportWorkflows(): Promise<string> {
    const workflows = await this.loadAllWorkflows()
    return JSON.stringify(workflows, null, 2)
  }

  /**
   * Import workflows from JSON
   */
  async importWorkflows(jsonData: string): Promise<{ success: boolean; imported: number; errors: string[] }> {
    try {
      const importedWorkflows = JSON.parse(jsonData)
      
      if (!Array.isArray(importedWorkflows)) {
        return { success: false, imported: 0, errors: ['Invalid format: expected array'] }
      }

      const errors: string[] = []
      let imported = 0

      for (const workflow of importedWorkflows) {
        try {
          // Basic validation
          if (!workflow.id || !workflow.name || !workflow.workflow_json) {
            errors.push(`Invalid workflow: missing required fields`)
            continue
          }

          // Convert dates if they're strings
          if (typeof workflow.createdAt === 'string') {
            workflow.createdAt = new Date(workflow.createdAt)
          }
          if (typeof workflow.modifiedAt === 'string') {
            workflow.modifiedAt = new Date(workflow.modifiedAt)
          }

          await this.addWorkflow(workflow)
          imported++
        } catch (error) {
          errors.push(`Failed to import workflow ${workflow.name}: ${error}`)
        }
      }

      return { success: errors.length === 0, imported, errors }
    } catch (error) {
      return { 
        success: false, 
        imported: 0, 
        errors: [`JSON parse error: ${error}`] 
      }
    }
  }

  /**
   * Get single workflow by ID (alias for findWorkflowById for compatibility)
   */
  async getWorkflow(id: string): Promise<Workflow | null> {
    return this.findWorkflowById(id)
  }

  /**
   * Check if IndexedDB is supported
   */
  static isSupported(): boolean {
    return typeof indexedDB !== 'undefined'
  }

  /**
   * Get storage quota information
   */
  async getStorageQuotaInfo(): Promise<{
    used: number;
    available: number;
    quota: number;
    usage: number; // percentage
    canAddWorkflow: boolean;
  }> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        const quota = estimate.quota || 0
        const used = estimate.usage || 0
        const available = quota - used
        const usage = quota > 0 ? (used / quota) * 100 : 0
        
        // IndexedDB can handle much larger datasets, so be more generous
        const canAddWorkflow = available > (1024 * 1024) // Need at least 1MB free
        
        return {
          used,
          available,
          quota,
          usage,
          canAddWorkflow
        }
      }
      
      // Fallback for browsers without storage API
      return {
        used: 0,
        available: 1024 * 1024 * 1024, // Assume 1GB available
        quota: 1024 * 1024 * 1024,
        usage: 0,
        canAddWorkflow: true
      }
    } catch (error) {
      console.warn('Could not get storage quota info:', error)
      return {
        used: 0,
        available: 1024 * 1024 * 1024,
        quota: 1024 * 1024 * 1024,
        usage: 0,
        canAddWorkflow: true
      }
    }
  }
}

// Create singleton instance
const indexedDBService = new IndexedDBWorkflowService()

// Export functions that match WorkflowStorageService API
export const loadAllWorkflows = () => indexedDBService.loadAllWorkflows()
export const saveAllWorkflows = (workflows: Workflow[]) => indexedDBService.saveAllWorkflows(workflows)
export const addWorkflow = (workflow: Workflow) => indexedDBService.addWorkflow(workflow)
export const updateWorkflow = (workflow: Workflow) => indexedDBService.updateWorkflow(workflow)
export const removeWorkflow = (workflowId: string) => indexedDBService.removeWorkflow(workflowId)
export const findWorkflowById = (workflowId: string) => indexedDBService.findWorkflowById(workflowId)
export const workflowExists = (workflowId: string) => indexedDBService.workflowExists(workflowId)
export const getWorkflowStats = () => indexedDBService.getWorkflowStats()
export const getWorkflowStorageSize = () => indexedDBService.getStorageSize()
export const clearAllWorkflows = () => indexedDBService.clearAllWorkflows()
export const exportWorkflows = () => indexedDBService.exportWorkflows()
export const importWorkflows = (jsonData: string) => indexedDBService.importWorkflows(jsonData)
export const getWorkflow = (id: string) => indexedDBService.getWorkflow(id)
export const getStorageQuotaInfo = () => indexedDBService.getStorageQuotaInfo()
export const isSupported = () => IndexedDBWorkflowService.isSupported()

// Export service instance for advanced usage
export default indexedDBService
export { IndexedDBWorkflowService }