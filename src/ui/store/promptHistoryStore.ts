import { create } from 'zustand';

interface PromptHistoryStore {
  isOpen: boolean;
  openPromptHistory: () => void;
  closePromptHistory: () => void;
}

export const usePromptHistoryStore = create<PromptHistoryStore>((set) => ({
  isOpen: false,
  openPromptHistory: () => set({ isOpen: true }),
  closePromptHistory: () => set({ isOpen: false }),
}));