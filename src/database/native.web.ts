// Web stub for native database - does nothing on web
export const initNativeDatabase = async (): Promise<void> => {
  // Web uses webStorage instead
};

export const getNativeDatabase = () => {
  return null;
};

export const closeNativeDatabase = async (): Promise<void> => {
  // Web uses webStorage instead
};
