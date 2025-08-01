import type { FeedbackListener, FeedbackMessage, FeedbackPiper } from '../contracts/feedback-piper';
export const createFeedbackPiper = (): FeedbackPiper => {
    const listeners = new Set<FeedbackListener>();
    const dispatch = (feedback: FeedbackMessage): void => {
        listeners.forEach((listener) => {
            try {
                listener(feedback);
            } catch (error) {
                console.error('Feedback listener error:', error);
            }
        });
    };
    return {
        subscribe: (listener: FeedbackListener): (() => void) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        unsubscribe: (listener: FeedbackListener): void => {
            listeners.delete(listener);
        },
        clear: (): void => {
            listeners.clear();
        },
        info: (message: string, code: number): void => {
            dispatch({
                level: 'info',
                message,
                code,
            });
        },
        error: (message: string, code: number): void => {
            dispatch({
                level: 'error',
                message,
                code,
            });
        },
    };
};
