import { NestFactory } from '@nestjs/core';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { printSchema } from 'graphql';
import { writeFileSync } from 'fs';
import { AppModule } from '../src/server/app.module.js';

async function generateSchema() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  await app.init();

  const { schema } = app.get(GraphQLSchemaHost);
  writeFileSync('schema.gql', printSchema(schema));

  await app.close();
  console.log('Schema generated successfully');
}

generateSchema()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });