const { createServer } = require('node:http');
const {
  getCollections,
  replaceCollectionRecipes,
  toRecipe,
} = require('./database');

const categories = new Set(['Breakfast', 'Lunch', 'Dinner', 'Dessert']);
const accents = {
  Breakfast: '#d4ae67',
  Lunch: '#79864e',
  Dinner: '#b85d45',
  Dessert: '#8d6471',
};

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  let tooLarge = false;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      tooLarge = true;
    } else {
      chunks.push(chunk);
    }
  }

  if (tooLarge) {
    throw new RequestError(413, 'Request body is too large.');
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RequestError(400, 'Request body must be valid JSON.');
  }
}

function validateDraft(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestError(400, 'Recipe data must be an object.');
  }

  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const category = typeof value.category === 'string' ? value.category : '';
  const time = value.time;
  const rating = value.rating;
  const image = typeof value.image === 'string' ? value.image.trim() : '';
  const steps = Array.isArray(value.steps)
    ? value.steps.map((step) => (typeof step === 'string' ? step.trim() : ''))
    : [];

  if (!title || title.length > 80) {
    throw new RequestError(400, 'Recipe title must be between 1 and 80 characters.');
  }
  if (!categories.has(category)) {
    throw new RequestError(400, 'Recipe category is invalid.');
  }
  if (typeof time !== 'number' || !Number.isInteger(time) || time < 1 || time > 999) {
    throw new RequestError(400, 'Recipe time must be between 1 and 999 minutes.');
  }
  if (typeof rating !== 'number' || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new RequestError(400, 'Recipe rating must be between 1 and 5.');
  }
  if (!image) {
    throw new RequestError(400, 'Recipe image URL is required.');
  }
  try {
    const parsedImage = new URL(image);
    if (!['http:', 'https:'].includes(parsedImage.protocol)) {
      throw new Error('Unsupported protocol.');
    }
  } catch {
    throw new RequestError(400, 'Recipe image must be a valid HTTP or HTTPS URL.');
  }
  if (steps.length === 0 || steps.some((step) => !step)) {
    throw new RequestError(400, 'Add at least one non-empty recipe step.');
  }

  return { title, category, time, rating, steps, image, accent: accents[category] };
}

function validateCollection(value, database) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestError(400, 'Collection data must be an object.');
  }

  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const description =
    value.description === undefined
      ? ''
      : typeof value.description === 'string'
        ? value.description.trim()
        : null;
  const recipeIds = value.recipeIds;

  if (!name || name.length > 80) {
    throw new RequestError(400, 'Collection name must be between 1 and 80 characters.');
  }
  if (description === null || description.length > 240) {
    throw new RequestError(400, 'Collection description must be 240 characters or fewer.');
  }
  if (
    !Array.isArray(recipeIds) ||
    recipeIds.length === 0 ||
    recipeIds.length > 500 ||
    recipeIds.some((id) => !Number.isSafeInteger(id) || id < 1) ||
    new Set(recipeIds).size !== recipeIds.length
  ) {
    throw new RequestError(400, 'Select at least one valid recipe for the collection.');
  }
  if (recipeIds.length > 0) {
    const placeholders = recipeIds.map(() => '?').join(', ');
    const matchingRecipes = database
      .prepare(`SELECT id FROM recipes WHERE id IN (${placeholders})`)
      .all(...recipeIds);
    if (matchingRecipes.length !== recipeIds.length) {
      throw new RequestError(400, 'A selected recipe could not be found.');
    }
  }

  return { name, description, recipeIds };
}

function inTransaction(database, operation) {
  database.exec('BEGIN');
  try {
    const result = operation();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function getRecipes(database) {
  return database
    .prepare('SELECT id, title, category, time, rating, steps, image, accent FROM recipes ORDER BY id')
    .all()
    .map(toRecipe);
}

async function routeRequest(request, response, database) {
  const url = new URL(request.url, 'http://localhost');
  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/recipes') {
    sendJson(response, 200, getRecipes(database));
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/collections') {
    sendJson(response, 200, getCollections(database));
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/collections') {
    const collection = validateCollection(await readJson(request), database);
    const created = inTransaction(database, () => {
      const result = database
        .prepare('INSERT INTO collections (name, description) VALUES (?, ?)')
        .run(collection.name, collection.description);
      const id = Number(result.lastInsertRowid);
      replaceCollectionRecipes(database, id, collection.recipeIds);
      return id;
    });
    const savedCollection = getCollections(database).find((item) => item.id === created);
    sendJson(response, 201, savedCollection);
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/recipes') {
    const recipe = validateDraft(await readJson(request));
    const result = database
      .prepare(`
        INSERT INTO recipes (title, category, time, rating, steps, image, accent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        recipe.title,
        recipe.category,
        recipe.time,
        recipe.rating,
        JSON.stringify(recipe.steps),
        recipe.image,
        recipe.accent,
      );
    sendJson(response, 201, { ...recipe, id: Number(result.lastInsertRowid) });
    return;
  }

  const recipeMatch = url.pathname.match(/^\/api\/recipes\/(\d+)$/);
  if (recipeMatch) {
    const id = Number(recipeMatch[1]);
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new RequestError(400, 'Recipe id is invalid.');
    }
    if (request.method === 'PUT') {
      const recipe = validateDraft(await readJson(request));
      const result = database
        .prepare(`
          UPDATE recipes
          SET title = ?, category = ?, time = ?, rating = ?, steps = ?, image = ?, accent = ?
          WHERE id = ?
        `)
        .run(
          recipe.title,
          recipe.category,
          recipe.time,
          recipe.rating,
          JSON.stringify(recipe.steps),
          recipe.image,
          recipe.accent,
          id,
        );
      if (result.changes === 0) {
        throw new RequestError(404, 'Recipe was not found.');
      }
      sendJson(response, 200, { ...recipe, id });
      return;
    }
    if (request.method === 'DELETE') {
      const result = database.prepare('DELETE FROM recipes WHERE id = ?').run(id);
      if (result.changes === 0) {
        throw new RequestError(404, 'Recipe was not found.');
      }
      response.writeHead(204);
      response.end();
      return;
    }
  }

  const collectionMatch = url.pathname.match(/^\/api\/collections\/(\d+)$/);
  if (collectionMatch) {
    const id = Number(collectionMatch[1]);
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new RequestError(400, 'Collection id is invalid.');
    }
    if (request.method === 'PUT') {
      const collection = validateCollection(await readJson(request), database);
      const updated = inTransaction(database, () => {
        const result = database
          .prepare('UPDATE collections SET name = ?, description = ? WHERE id = ?')
          .run(collection.name, collection.description, id);
        if (result.changes === 0) {
          throw new RequestError(404, 'Collection was not found.');
        }
        replaceCollectionRecipes(database, id, collection.recipeIds);
        return true;
      });
      if (updated) {
        const savedCollection = getCollections(database).find((item) => item.id === id);
        sendJson(response, 200, savedCollection);
      }
      return;
    }
    if (request.method === 'DELETE') {
      const result = database.prepare('DELETE FROM collections WHERE id = ?').run(id);
      if (result.changes === 0) {
        throw new RequestError(404, 'Collection was not found.');
      }
      response.writeHead(204);
      response.end();
      return;
    }
  }

  sendJson(response, 404, { error: 'API route was not found.' });
}

function createApiServer(database) {
  return createServer((request, response) => {
    routeRequest(request, response, database).catch((error) => {
      if (error instanceof RequestError) {
        sendJson(response, error.status, { error: error.message });
        return;
      }
      console.error('Recipe API request failed:', error);
      sendJson(response, 500, { error: 'The recipe request could not be completed.' });
    });
  });
}

module.exports = { createApiServer };
