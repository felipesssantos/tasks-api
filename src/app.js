// app.js
const fastify = require('fastify')({
  logger: true
});
require('dotenv').config();
const { initializeTables, validateTables } = require('./config/initDb');
const { checkConnection } = require('./scripts/checkDb');

const PORT = process.env.PORT || 3000;

// Registra o swagger para documentação da API
fastify.register(require('@fastify/swagger'), {
  swagger: {
    info: {
      title: 'Tasks API',
      description: 'API de gerenciamento de tarefas',
      version: '1.0.0'
    },
    schemes: ['http'],
    consumes: ['application/json'],
    produces: ['application/json'],
    securityDefinitions: {
      bearerAuth: {
        type: 'apiKey',
        name: 'Authorization',
        in: 'header'
      }
    }
  }
});

// Registra a UI do Swagger
fastify.register(require('@fastify/swagger-ui'), {
  routePrefix: '/documentation',
  uiConfig: {
    docExpansion: 'full',
    deepLinking: false
  },
  uiHooks: {
    onRequest: function (request, reply, next) { next() },
    preHandler: function (request, reply, next) { next() }
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
  transformSpecification: (swaggerObject, request, reply) => { return swaggerObject },
  transformSpecificationClone: true
});

// Registra o plugin JWT
fastify.register(require('@fastify/jwt'), {
  secret: process.env.JWT_SECRET || 'seu_secret_aqui_mude_em_producao'
});

// Adiciona decorator para autenticação
fastify.decorate('authenticate', async function(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Não autorizado' });
  }
});

// Rota básica de teste
fastify.get('/', async (request, reply) => {
  return { message: 'API de Tarefas - Online' };
});

// Rota de health check
fastify.get('/health', async (request, reply) => {
  try {
    const AWS = require('aws-sdk');
    const dynamodb = new AWS.DynamoDB.DocumentClient({
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000'
    });
    
    await dynamodb.scan({ TableName: 'Tasks', Limit: 1 }).promise();
    return { 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      database: 'connected'
    };
  } catch (error) {
    reply.code(500).send({ 
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// Registra as rotas
fastify.register(require('./routes/auth'), { prefix: '/auth' });
fastify.register(require('./routes/tasks'), { prefix: '/api' });

// Função para iniciar o servidor
const start = async () => {
  try {
    // Inicializa as tabelas com até 5 tentativas
    await initializeTables(5);
    
    // Valida se todas as tabelas estão prontas
    const tablesReady = await validateTables();
    if (!tablesReady) {
      throw new Error('Required tables are not ready');
    }

    // Configura CORS
    await fastify.register(require('@fastify/cors'), {
      origin: true, // em produção, especifique os domínios permitidos
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true
    });

    // Inicia o servidor
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    fastify.log.info(`Server running at http://localhost:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
