// src/routes/tasks.js
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000'
});

// Schemas para o Swagger
const taskSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    completed: { type: 'boolean' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  }
};

const createTaskSchema = {
  body: {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string' },
      description: { type: 'string' }
    }
  },
  response: {
    201: taskSchema
  },
  security: [
    { bearerAuth: [] }
  ]
};

const updateTaskSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' }
    }
  },
  body: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      completed: { type: 'boolean' }
    }
  },
  response: {
    200: taskSchema
  },
  security: [
    { bearerAuth: [] }
  ]
};

const getTaskSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' }
    }
  },
  response: {
    200: taskSchema
  },
  security: [
    { bearerAuth: [] }
  ]
};

const getAllTasksSchema = {
  response: {
    200: {
      type: 'array',
      items: taskSchema
    }
  },
  security: [
    { bearerAuth: [] }
  ]
};

const deleteTaskSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' }
    }
  },
  response: {
    204: {
      type: 'null'
    }
  },
  security: [
    { bearerAuth: [] }
  ]
};

async function routes(fastify, options) {
  // Criar task
  fastify.post('/tasks', { 
    onRequest: [fastify.authenticate],
    schema: createTaskSchema 
  }, async (request, reply) => {
    const { title, description } = request.body;
    const userId = request.user.userId;
    const now = new Date().toISOString();

    const task = {
      id: uuidv4(),
      userId,
      title,
      description: description || '',
      completed: false,
      createdAt: now,
      updatedAt: now
    };

    try {
      await dynamodb.put({
        TableName: 'Tasks',
        Item: task
      }).promise();

      reply.code(201).send(task);
    } catch (error) {
      request.log.error(error);
      reply.code(500).send({ error: 'Erro ao criar task' });
    }
  });

  // Listar todas as tasks do usuário
  fastify.get('/tasks', { 
    onRequest: [fastify.authenticate],
    schema: getAllTasksSchema 
  }, async (request, reply) => {
    const userId = request.user.userId;

    try {
      const result = await dynamodb.query({
        TableName: 'Tasks',
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      }).promise();

      return result.Items;
    } catch (error) {
      request.log.error(error);
      reply.code(500).send({ error: 'Erro ao listar tasks' });
    }
  });

  // Buscar task por ID
  fastify.get('/tasks/:id', { 
    onRequest: [fastify.authenticate],
    schema: getTaskSchema 
  }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.userId;

    try {
      const result = await dynamodb.get({
        TableName: 'Tasks',
        Key: { id }
      }).promise();

      if (!result.Item) {
        reply.code(404).send({ error: 'Task não encontrada' });
        return;
      }

      // Verifica se a task pertence ao usuário
      if (result.Item.userId !== userId) {
        reply.code(403).send({ error: 'Acesso não autorizado' });
        return;
      }

      return result.Item;
    } catch (error) {
      request.log.error(error);
      reply.code(500).send({ error: 'Erro ao buscar task' });
    }
  });

  // Atualizar task
  fastify.put('/tasks/:id', { 
    onRequest: [fastify.authenticate],
    schema: updateTaskSchema 
  }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.userId;
    const { title, description, completed } = request.body;

    try {
      // Primeiro verifica se a task existe e pertence ao usuário
      const existingTask = await dynamodb.get({
        TableName: 'Tasks',
        Key: { id }
      }).promise();

      if (!existingTask.Item) {
        reply.code(404).send({ error: 'Task não encontrada' });
        return;
      }

      if (existingTask.Item.userId !== userId) {
        reply.code(403).send({ error: 'Acesso não autorizado' });
        return;
      }

      const updatedTask = {
        ...existingTask.Item,
        title: title || existingTask.Item.title,
        description: description !== undefined ? description : existingTask.Item.description,
        completed: completed !== undefined ? completed : existingTask.Item.completed,
        updatedAt: new Date().toISOString()
      };

      await dynamodb.put({
        TableName: 'Tasks',
        Item: updatedTask
      }).promise();

      return updatedTask;
    } catch (error) {
      request.log.error(error);
      reply.code(500).send({ error: 'Erro ao atualizar task' });
    }
  });

  // Deletar task
  fastify.delete('/tasks/:id', { 
    onRequest: [fastify.authenticate],
    schema: deleteTaskSchema 
  }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.userId;

    try {
      // Verifica se a task existe e pertence ao usuário
      const existingTask = await dynamodb.get({
        TableName: 'Tasks',
        Key: { id }
      }).promise();

      if (!existingTask.Item) {
        reply.code(404).send({ error: 'Task não encontrada' });
        return;
      }

      if (existingTask.Item.userId !== userId) {
        reply.code(403).send({ error: 'Acesso não autorizado' });
        return;
      }

      await dynamodb.delete({
        TableName: 'Tasks',
        Key: { id }
      }).promise();

      reply.code(204).send();
    } catch (error) {
      request.log.error(error);
      reply.code(500).send({ error: 'Erro ao deletar task' });
    }
  });
}

module.exports = routes;
