import { existsSync, mkdirSync, rm, rmSync, writeFileSync } from "fs";
import { IModel, ISchema } from "./ISchema";
import { dirname } from "path";
import { toCamelCaseWithFirstLower, toSnakeCase } from "./utils";

interface File {
    name: string;
    content: string;
}

export class Generator {

    constructor(private readonly schema: ISchema, private readonly outputDirectory: string) {

    }

    generate() {
        console.log('Generating code...');
        const files = [
            ...this.generateInterfaces(),
            ...this.generateEntryPoint(),
            ...this.generateUtils(),
            ...this.generateCRUD(),
            ...this.generateMethods()
        ];
        if (existsSync(this.outputDirectory)) {
            rmSync(this.outputDirectory, { recursive: true });
        }
        mkdirSync(this.outputDirectory, { recursive: true });
        for (const file of files) {

            if (!existsSync(this.outputDirectory) + '/' + dirname(file.name)) {
                mkdirSync(this.outputDirectory + '/' + dirname(file.name), { recursive: true });
            }

            const path = `${this.outputDirectory}/${file.name}`;
            writeFileSync(path, file.content);
        }


    }

    generateInterfaces() {
        console.log('Generating interfaces...');
        const files: File[] = [];
        for (const model of this.schema.models) {
            const content =
                `export interface ${model.model_name} {\n${model.fields.map(f => `   ${toCamelCaseWithFirstLower(f.field_name) + (f.is_optional ? '?' : '')}: ${this.#convertType(f.type)} // ${toSnakeCase(f.field_name)}`).join('\n')}\n}`;
            files.push({ name: `types/${model.model_name}.ts`, content });
        }

        const entry = `${this.schema.models.map(m => `export * from './${m.model_name}';`).join('\n')}`;
        files.push({ name: 'types/index.ts', content: entry });

        return files;
    }
    generateEntryPoint() {
        console.log('Generating entry point...');
        const files: File[] = [];
        const content = `export * from './types';
export * from './utils';
${this.schema.models.map(m => `export * from './services/${m.model_name}';`).join('\n')}
${this.schema.models.map(m => `export * from './methods/${m.model_name}';`).join('\n')}`;


        files.push({ name: 'index.ts', content });
        return files;
    }
    generateUtils() {
        console.log('Generating utils...');
        const files: File[] = [];
        const urlSettings = `let url:string|undefined = undefined; let unixSocket:string|undefined = undefined; export const apiSettings = { setURL: (newURL:string) => { url = newURL; }, getURL: () => { return url; }, setUnixSocket: (newUnixSocket:string) => { unixSocket = newUnixSocket; }, getUnixSocket: () => { return unixSocket; } };`;
        files.push({ name: 'utils/apiSettings.ts', content: urlSettings });
        const getAxiosInstance = `import axios from 'axios'; import { apiSettings } from './apiSettings'; export const getAPIAxiosInstance = () => { 
        if (!apiSettings.getURL() && !apiSettings.getUnixSocket()) { throw new Error('URL or Unix Socket is not set'); }
        if (apiSettings.getUnixSocket()) { return axios.create({ baseURL: 'http://localhost', socketPath: apiSettings.getUnixSocket() }); } else { return axios.create({ baseURL: apiSettings.getURL() }); } };`;
        files.push({ name: 'utils/getAxiosInstance.ts', content: getAxiosInstance });
        const utils = `export * from './apiSettings'; export * from './getAxiosInstance';`;
        files.push({ name: 'utils/index.ts', content: utils });

        return files;
    }
    generateCRUD() {

        console.log('Generating CRUD...');
        const files: File[] = [];

        for (const model of this.schema.models) {
            const content = `import { ${model.model_name} } from '../types'; import { getAPIAxiosInstance } from '../utils'; 
export const ${model.model_name}CRUD = {
    mapResponse(item: any): ${model.model_name} {
        ${this.#getFieldsMapping(model)}
        return obj;
    },
    mapRequest(data: Partial<${model.model_name}>): any {
        return {
            ${model.fields.map(f => `${toSnakeCase(f.field_name)}: data.${toCamelCaseWithFirstLower(f.field_name)},`).join('\n')}
        };
    },
     async get (limit?: number, offset?: number) {
        const response = await getAPIAxiosInstance().get('/crud/${toSnakeCase(model.model_name)}', { params: { limit, offset } });
        const array: ${model.model_name}[] = []
        for (const item of response.data) {
            const obj = this.mapResponse(item);
            array.push(obj);
        }
        return array;

    },
    async getById(id: number) {
        const response = await getAPIAxiosInstance().get('/crud/${toSnakeCase(model.model_name)}/'+id);
        const responseObj = this.mapResponse(response.data);
        return responseObj;
    },
    async create(data: Omit<${model.model_name}, 'id'>) {
        const response = await getAPIAxiosInstance().post('/crud/${toSnakeCase(model.model_name)}', this.mapRequest(data));
        return this.mapResponse(response.data);
    },
    async createMany(data: Omit<${model.model_name}, 'id'>[]) {
        const response = await getAPIAxiosInstance().post('/crud/${toSnakeCase(model.model_name)}/many', data.map(d => this.mapRequest(d)));
        const array: ${model.model_name}[] = []
        for (const item of response.data) {
            const obj = this.mapResponse(item);
            array.push(obj);
        }
        return array;

    },
    async update(id: number, data: Partial<Omit<${model.model_name}, 'id'>>) {
        const response = await getAPIAxiosInstance().put('/crud/${toSnakeCase(model.model_name)}/'+id, this.mapRequest(data));
        return this.mapResponse(response.data);
    },
    async delete(id: number) {
        const response = await getAPIAxiosInstance().delete('/crud/${toSnakeCase(model.model_name)}/'+id);
        return this.mapResponse(response.data);
    },

    async count(): Promise<number> {
        const response = await getAPIAxiosInstance().get('/crud/${toSnakeCase(model.model_name)}/count');
        return response.data.count;
    }

};`;
            files.push({ name: `services/${model.model_name}.ts`, content });
        }
        return files;

    }


    generateMethods() {
        console.log('Generating methods...');
        const files: File[] = [];
        for (const model of this.schema.models) {
            const content = `
            import { ${model.model_name} } from '../types'; import { getAPIAxiosInstance } from '../utils';
            import { ${model.model_name}CRUD } from '../services/${model.model_name}';
            ${model.edges.map(e => e.type).filter((value, index, self) => self.indexOf(value) === index).map(e => `import { ${e}CRUD } from '../services/${e}';`).join('\n')}
            export interface ${model.model_name}SearchInput {
            ${model.fields.map(f => {
                if (f.type === 'string') {
                    return `${toCamelCaseWithFirstLower(f.field_name)}?: string;\n${toCamelCaseWithFirstLower(f.field_name)}Contains?: string;`;
                } else if (f.type === '[]string') {
                    return `${toCamelCaseWithFirstLower(f.field_name)}?: string[];\n${toCamelCaseWithFirstLower(f.field_name)}OneContains?: string[];\n${toCamelCaseWithFirstLower(f.field_name)}AllContains?: string[];\n${toCamelCaseWithFirstLower(f.field_name)}NoneContains?: string[];`;
                } else if (f.type === 'int') {
                    return `${toCamelCaseWithFirstLower(f.field_name)}?: number;\n${toCamelCaseWithFirstLower(f.field_name)}Contains?: number;`;
                } else if (f.type === '[]int') {
                    return `${toCamelCaseWithFirstLower(f.field_name)}?: number[];\n${toCamelCaseWithFirstLower(f.field_name)}Contains?: number[];`;
                } else if (f.type === 'bool') {
                    return `${toCamelCaseWithFirstLower(f.field_name)}?: boolean;`;
                } else if (f.type === 'time.Time') {
                    return `${toCamelCaseWithFirstLower(f.field_name)}?: Date;\n${toCamelCaseWithFirstLower(f.field_name)}Contains?: Date;\n${toCamelCaseWithFirstLower(f.field_name)}Start?: Date;\n${toCamelCaseWithFirstLower(f.field_name)}End?: Date;`;
                }
                return '';
            }).join('\n')}
        }
export const ${model.model_name}API = {
    async search(input: ${model.model_name}SearchInput, limit?: number, offset?: number) {
        const response = await getAPIAxiosInstance().get('/api/${toSnakeCase(model.model_name)}/search', { params: { ...input, limit, offset } });
        const array: ${model.model_name}[] = []
        for (const item of response.data) {
            const obj = ${model.model_name}CRUD.mapResponse(item);
            array.push(obj);
        }
        return array;
    },

    ${model.edges.map(e => {
                if (e.direction === 'to') {
                    return `async get${e.edge_name[0].toUpperCase() + toCamelCaseWithFirstLower(e.edge_name.slice(1))}(id: number) {
        const response = await getAPIAxiosInstance().get('/api/${toSnakeCase(model.model_name)}/'+id+'/${e.edge_name}');
        const responseObj = Array.isArray(response.data) ? response.data.map((item:any) => ${e.type}CRUD.mapResponse(item)) : ${e.type}CRUD.mapResponse(response.data);
        return responseObj; 
    },
    async connect${e.edge_name[0].toUpperCase() + toCamelCaseWithFirstLower(e.edge_name.slice(1))}(id: number, ${e.edge_name}Id: number) {
        const response = await getAPIAxiosInstance().post('/api/${toSnakeCase(model.model_name)}/'+id+'/${e.edge_name}', { ${e.edge_name}_id: ${e.edge_name}Id });
        return this.get${e.edge_name[0].toUpperCase() + toCamelCaseWithFirstLower(e.edge_name.slice(1))}(id);
    },
    async disconnect${e.edge_name[0].toUpperCase() + toCamelCaseWithFirstLower(e.edge_name.slice(1))}(id: number) {
        const response = await getAPIAxiosInstance().delete('/api/${toSnakeCase(model.model_name)}/${e.edge_name}', { params: { id } });
        return this.get${e.edge_name[0].toUpperCase() + toCamelCaseWithFirstLower(e.edge_name.slice(1))}(id);
    },`
                }
                else {
                    return `async get${model.model_name}By${e.edge_name[0].toUpperCase() + toCamelCaseWithFirstLower(e.edge_name.slice(1))}(id: number) {
        const response = await getAPIAxiosInstance().get('/api/${toSnakeCase(model.model_name)}/'+id);  
        const responseObj = ${model.model_name}CRUD.mapResponse(response.data);
        return responseObj;
    },` 

                }
            }
            ).join('\n')}
};`;
            files.push({ name: `methods/${model.model_name}.ts`, content })
        }
        return files;

    }

    #convertType(type: string): string {
        // type = type.trim().toLowerCase();
        switch (type) {

            case 'int': return 'number';
            case '[]int': return 'number[]';
            case 'string': return 'string';
            case '[]string': return 'string[]';
            case 'bool': return 'boolean';
            case '[]bool': return 'boolean[]';
            case 'float': return 'number';
            case '[]float': return 'number[]';
            case 'time.Time': return 'Date';
            case '[]time.Time': return 'Date[]';

            default: return type;
        }
    }
    #getFieldsMapping(model: IModel): string {
        let map = `const obj: ${model.model_name} = {`
        for (const field of model.fields) {
            const type = this.#convertType(field.type);
            if (type === 'Date') {
                map += `\n            ${toCamelCaseWithFirstLower(field.field_name)}: (()=>{let d = new Date(item.${toSnakeCase(field.field_name)}); return d.getTime()==0 ? ${field.is_optional ? 'undefined' : 'd'} : d;})(),`;
            } else if (type === 'Date[]') {
                map += `\n            ${toCamelCaseWithFirstLower(field.field_name)}: item.${toSnakeCase(field.field_name)}.map((d:any)=>{let date = new Date(d); return date.getTime()==0 ? ${field.is_optional ? 'undefined' : 'date'} : date;}),`;
            }
            else {
                map += `\n            ${toCamelCaseWithFirstLower(field.field_name)}: item.${toSnakeCase(field.field_name)},`;
            }

        }
        map += '\n        }';
        return map;

    }
}