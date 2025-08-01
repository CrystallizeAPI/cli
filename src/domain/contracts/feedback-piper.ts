type FeedbackLevel = 'info' | 'error';
export type FeedbackMessage = {
    level: FeedbackLevel;
    message: string;
    code: number;
};
export type FeedbackListener = (feedback: FeedbackMessage) => void;
export type FeedbackPiper = {
    subscribe: (listener: FeedbackListener) => () => void;
    unsubscribe: (listener: FeedbackListener) => void;
    clear: () => void;
    info: (message: string, code: number) => void;
    error: (message: string, code: number) => void;
};
