export type S3Uploader = (
    payload: { url: string; fields: { name: string; value: string }[] },
    fileContent: string | ArrayBuffer,
) => Promise<string>;
