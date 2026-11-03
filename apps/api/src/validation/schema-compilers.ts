import {
  serializerCompiler,
  validatorCompiler,
} from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";

export function registerSchemaCompilers(application: FastifyInstance) {
  application.setValidatorCompiler(validatorCompiler);
  application.setSerializerCompiler(serializerCompiler);
}
