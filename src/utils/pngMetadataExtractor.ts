/**
 * PNG Metadata Extractor for ComfyUI Workflows
 * 
 * ComfyUI saves workflow data in PNG chunks:
 * - "workflow" chunk: Contains the workflow JSON
 * - "prompt" chunk: Contains the prompt/node configuration
 * 
 * This utility extracts these chunks and reconstructs the workflow data.
 */

export interface PngWorkflowData {
  workflow?: any;
  prompt?: any;
  filename?: string;
}

export interface PngExtractionResult {
  success: boolean;
  data?: PngWorkflowData;
  error?: string;
}

/**
 * Extract workflow metadata from PNG file
 */
export const extractWorkflowFromPng = async (file: File): Promise<PngExtractionResult> => {
  try {
    if (!file.type.includes('image/png')) {
      return {
        success: false,
        error: 'File is not a PNG image'
      };
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Verify PNG signature
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < pngSignature.length; i++) {
      if (uint8Array[i] !== pngSignature[i]) {
        return {
          success: false,
          error: 'Invalid PNG file signature'
        };
      }
    }

    const chunks = parsePngChunks(uint8Array);
    
    console.group(`🔍 PNG Chunk Analysis: ${file.name}`);
    console.log(`📏 File size: ${(file.size / 1024).toFixed(2)} KB`);
    console.log(`🧩 Total chunks found: ${chunks.length}`);
    console.log('📋 Chunk types:', chunks.map(c => c.type).join(', '));
    
    const workflowData: PngWorkflowData = {
      filename: file.name
    };

    // Extract workflow data from chunks
    for (const chunk of chunks) {
      if (chunk.type === 'workflow') {
        try {
          const workflowJson = new TextDecoder().decode(chunk.data);
          console.log(`🔧 Found 'workflow' chunk (${chunk.data.length} bytes)`);
          console.log('📄 Raw workflow JSON:', workflowJson.substring(0, 200) + '...');
          workflowData.workflow = JSON.parse(workflowJson);
          console.log('✅ Successfully parsed workflow chunk');
        } catch (error) {
          console.warn('❌ Failed to parse workflow chunk:', error);
        }
      } else if (chunk.type === 'prompt') {
        try {
          const promptJson = new TextDecoder().decode(chunk.data);
          console.log(`💬 Found 'prompt' chunk (${chunk.data.length} bytes)`);
          console.log('📄 Raw prompt JSON:', promptJson.substring(0, 200) + '...');
          workflowData.prompt = JSON.parse(promptJson);
          console.log('✅ Successfully parsed prompt chunk');
        } catch (error) {
          console.warn('❌ Failed to parse prompt chunk:', error);
        }
      } else if (chunk.type === 'tEXt') {
        // Parse tEXt chunk for ComfyUI metadata
        try {
          const textData = parseTEXtChunk(chunk.data);
          console.log(`📝 Found tEXt chunk - Key: "${textData.keyword}", Value: ${textData.text.length} chars`);
          
          if (textData.keyword === 'workflow') {
            console.log(`🔧 Found workflow in tEXt chunk (${textData.text.length} bytes)`);
            console.log('📄 Raw workflow JSON:', textData.text.substring(0, 200) + '...');
            workflowData.workflow = JSON.parse(textData.text);
            console.log('✅ Successfully parsed workflow from tEXt chunk');
          } else if (textData.keyword === 'prompt') {
            console.log(`💬 Found prompt in tEXt chunk (${textData.text.length} bytes)`);
            console.log('📄 Raw prompt JSON:', textData.text.substring(0, 200) + '...');
            workflowData.prompt = JSON.parse(textData.text);
            console.log('✅ Successfully parsed prompt from tEXt chunk');
          } else {
            console.log(`ℹ️ Other tEXt data: "${textData.keyword}" = "${textData.text.substring(0, 100)}..."`);
          }
        } catch (error) {
          console.warn('❌ Failed to parse tEXt chunk:', error);
        }
      }
    }
    console.groupEnd();

    // Check if we found any workflow data
    if (!workflowData.workflow && !workflowData.prompt) {
      return {
        success: false,
        error: 'No ComfyUI workflow metadata found in PNG'
      };
    }

    return {
      success: true,
      data: workflowData
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error extracting PNG metadata'
    };
  }
};

/**
 * Parse PNG chunks to extract metadata
 */
interface PngChunk {
  length: number;
  type: string;
  data: Uint8Array;
  crc: number;
}

const parsePngChunks = (data: Uint8Array): PngChunk[] => {
  const chunks: PngChunk[] = [];
  let offset = 8; // Skip PNG signature

  while (offset < data.length) {
    // Read chunk length (4 bytes, big endian)
    if (offset + 8 > data.length) break;
    
    const length = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
    offset += 4;

    // Read chunk type (4 bytes)
    const typeBytes = data.slice(offset, offset + 4);
    const type = new TextDecoder().decode(typeBytes);
    offset += 4;

    // Read chunk data
    if (offset + length + 4 > data.length) break;
    
    const chunkData = data.slice(offset, offset + length);
    offset += length;

    // Read CRC (4 bytes)
    const crc = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
    offset += 4;

    chunks.push({
      length,
      type,
      data: chunkData,
      crc
    });

    // Stop at IEND chunk
    if (type === 'IEND') {
      break;
    }
  }

  return chunks;
};

/**
 * Parse PNG tEXt chunk data
 */
const parseTEXtChunk = (data: Uint8Array): { keyword: string; text: string } => {
  // tEXt chunk format: keyword + null separator + text
  let nullIndex = -1;
  
  // Find null separator
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 0) {
      nullIndex = i;
      break;
    }
  }
  
  if (nullIndex === -1) {
    throw new Error('Invalid tEXt chunk: no null separator found');
  }
  
  // Extract keyword and text
  const keyword = new TextDecoder('latin1').decode(data.slice(0, nullIndex));
  const text = new TextDecoder('latin1').decode(data.slice(nullIndex + 1));
  
  return { keyword, text };
};

/**
 * Convert PNG workflow data to standard workflow format
 */
export const convertPngDataToWorkflow = (pngData: PngWorkflowData): any => {
  console.group('🔄 Converting PNG Data to Workflow Format');
  console.log('📥 Input data:', pngData);
  
  // If we have workflow data, use it directly
  if (pngData.workflow) {
    console.log('✅ Using workflow data directly');
    console.log('🗂️ Workflow structure:', {
      hasNodes: !!pngData.workflow.nodes,
      hasLinks: !!pngData.workflow.links,
      hasGroups: !!pngData.workflow.groups,
      version: pngData.workflow.version,
      keys: Object.keys(pngData.workflow)
    });
    console.groupEnd();
    return pngData.workflow;
  }

  // If we only have prompt data, try to reconstruct workflow
  if (pngData.prompt) {
    console.log('⚠️ Only prompt data available, attempting conversion');
    console.log('💬 Prompt structure:', {
      type: typeof pngData.prompt,
      keys: Object.keys(pngData.prompt),
      nodeCount: Object.keys(pngData.prompt).length
    });
    
    // ComfyUI prompt format needs to be converted to workflow format
    const converted = convertPromptToWorkflow(pngData.prompt);
    console.log('🔧 Converted result:', converted);
    console.groupEnd();
    return converted;
  }

  console.error('❌ No valid workflow data found');
  console.groupEnd();
  throw new Error('No valid workflow data found');
};

/**
 * Convert ComfyUI prompt format to workflow format
 */
const convertPromptToWorkflow = (prompt: any): any => {
  // This is a simplified conversion - ComfyUI prompt format is different from workflow format
  // The prompt format contains node configurations but not the full workflow structure
  
  if (typeof prompt === 'object' && prompt !== null) {
    // Try to extract nodes from prompt structure
    const nodes: { [key: string]: any } = {};
    
    // ComfyUI prompt format typically has numbered keys for nodes
    for (const [key, value] of Object.entries(prompt)) {
      if (typeof value === 'object' && value !== null) {
        nodes[key] = value;
      }
    }

    return {
      nodes,
      links: [], // Links are not stored in prompt format
      groups: [],
      config: {},
      extra: {},
      version: 0.4
    };
  }

  throw new Error('Invalid prompt format');
};

/**
 * Check if a file is a PNG with workflow metadata
 */
export const isPngWithWorkflow = async (file: File): Promise<boolean> => {
  if (!file.type.includes('image/png')) {
    return false;
  }

  try {
    const result = await extractWorkflowFromPng(file);
    return result.success;
  } catch {
    return false;
  }
};

/**
 * Get a preview of what's in the PNG metadata (for user feedback)
 */
export const getPngWorkflowPreview = async (file: File): Promise<{
  hasWorkflow: boolean;
  hasPrompt: boolean;
  nodeCount?: number;
  error?: string;
}> => {
  try {
    const result = await extractWorkflowFromPng(file);
    
    if (!result.success) {
      return {
        hasWorkflow: false,
        hasPrompt: false,
        error: result.error
      };
    }

    const data = result.data!;
    let nodeCount = 0;

    // Count nodes from workflow
    if (data.workflow?.nodes) {
      nodeCount = Object.keys(data.workflow.nodes).length;
    }
    // Count nodes from prompt
    else if (data.prompt) {
      nodeCount = Object.keys(data.prompt).length;
    }

    return {
      hasWorkflow: !!data.workflow,
      hasPrompt: !!data.prompt,
      nodeCount: nodeCount > 0 ? nodeCount : undefined
    };

  } catch (error) {
    return {
      hasWorkflow: false,
      hasPrompt: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};