export interface Model {
    provider: string;
    name: string;
}

export function getModel(provider: string, modelName: string): Model {
    return {
        provider,
        name: modelName
    };
}