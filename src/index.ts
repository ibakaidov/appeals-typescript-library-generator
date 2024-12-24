import { Generator } from "./generator";
import { ISchema } from "./ISchema";

async function main(schemaUrl = 'http://localhost:8080/static/schema.json', outputDir = 'src/generated') {
    const schema = await fetch(schemaUrl).then(res => res.json() as Promise<ISchema>);
    const generator = new Generator(schema, outputDir);   
    generator.generate();
}   
main(process.argv[2], process.argv[3]);
