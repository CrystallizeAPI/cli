type FeedbackLevel = 'info' | 'error';
export type FeedbackMessage = {
    level: FeedbackLevel;
    message: string;
};
export type FeedbackListener = (feedback: FeedbackMessage) => void;
export type FeedbackPiper = {
    subscribe: (listener: FeedbackListener) => () => void;
    unsubscribe: (listener: FeedbackListener) => void;
    clear: () => void;
    info: (message: string) => void;
    error: (message: string) => void;
};
