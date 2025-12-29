// /types/swagger.d.ts
declare module 'swagger-annotations' {
  export interface SwaggerPath {
    [method: string]: {
      tags?: string[];
      summary?: string;
      description?: string;
      parameters?: any[];
      requestBody?: any;
      responses?: any;
      security?: any[];
      deprecated?: boolean;
    };
  }

  export interface SwaggerConfig {
    openapi: string;
    info: any;
    servers?: any[];
    tags?: any[];
    paths?: { [path: string]: SwaggerPath };
    components?: any;
  }
}
