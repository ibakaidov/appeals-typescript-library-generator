import axios from "axios";
import { Generator } from "./generator";
import { ISchema } from "./ISchema";

async function main(schemaUrl = 'http://localhost:8080/static/schema.json', outputDir = 'src/generated') {
    let schema: ISchema;
    if (schemaUrl.startsWith('unix:')) {
        const data = await axios.get<ISchema>(schemaUrl.split(':')[1], { socketPath: schemaUrl.split(':')[0] })
        schema = data.data;

    } else {
        const data = await axios.get(schemaUrl);
        schema = data.data;
    }
    const generator = new Generator(schema, outputDir);   
    generator.generate();
}   
main(process.argv[2], process.argv[3]);
