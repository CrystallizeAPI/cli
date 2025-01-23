import type { S3Uploader } from '../domain/contracts/s3-uploader';

export const createS3Uploader = (): S3Uploader => {
    return async (payload, fileContent) => {
        const formData = new FormData();
        payload.fields.forEach((field: { name: string; value: string }) => {
            formData.append(field.name, field.value);
        });
        const arrayBuffer = Buffer.from(fileContent).buffer;
        const buffer = Buffer.from(arrayBuffer);
        formData.append('file', new Blob([buffer]));
        await fetch(payload.url, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
            },
            body: formData,
        });
        const key = formData.get('key') as string;
        return key;
    };
};
