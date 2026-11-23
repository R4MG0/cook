const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { createApiServer } = require('./api');
const { createDatabase } = require('./database');

async function withApi(run, databasePath = ':memory:', fetchImplementation = fetch) {
  const database = createDatabase(databasePath);
  const server = createApiServer(database, fetchImplementation);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    database.close();
  }
}

const draft = {
  title: 'Test soup',
  category: 'Dinner',
  time: 45,
  rating: 4.5,
  steps: ['Chop vegetables', 'Simmer until tender'],
  image: 'https://example.com/soup.jpg',
};

test('recipe API seeds, creates, updates, and deletes persisted recipes', async () => {
  await withApi(async (baseUrl) => {
    const initialResponse = await fetch(`${baseUrl}/api/recipes`);
    const initialRecipes = await initialResponse.json();
    assert.equal(initialResponse.status, 200);
    assert.equal(initialRecipes.length, 6);

    const createResponse = await fetch(`${baseUrl}/api/recipes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(draft),
    });
    const created = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(created.steps[1], 'Simmer until tender');

    const updateResponse = await fetch(`${baseUrl}/api/recipes/${created.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...draft, title: 'Updated soup', steps: ['Simmer slowly'] }),
    });
    assert.equal(updateResponse.status, 200);
    assert.equal((await updateResponse.json()).title, 'Updated soup');

    const deleteResponse = await fetch(`${baseUrl}/api/recipes/${created.id}`, { method: 'DELETE' });
    assert.equal(deleteResponse.status, 204);
    const finalRecipes = await (await fetch(`${baseUrl}/api/recipes`)).json();
    assert.equal(finalRecipes.length, 6);
  });
});

test('recipe API rejects invalid recipe data', async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/recipes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...draft, steps: [''] }),
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /non-empty recipe step/);
  });
});

test('recipe inspiration searches TheMealDB and returns compact recipe results', async () => {
  const meal = {
    idMeal: '52772',
    strMeal: 'Teriyaki Chicken Casserole',
    strCategory: 'Chicken',
    strArea: 'Japanese',
    strMealThumb: 'https://example.com/meal.jpg',
    strSource: 'https://example.com/recipe',
    strInstructions: 'Bake until golden.',
    strIngredient1: 'Chicken',
    strMeasure1: '2 cups',
    strIngredient2: ' ',
  };
  let requestedUrl;
  const fetchImplementation = async (url) => {
    requestedUrl = url;
    return { ok: true, json: async () => ({ meals: [meal] }) };
  };

  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/inspiration?q=chicken%20casserole`);
    const results = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requestedUrl.hostname, 'www.themealdb.com');
    assert.equal(requestedUrl.searchParams.get('s'), 'chicken casserole');
    assert.deepEqual(results, [{
      id: '52772',
      name: 'Teriyaki Chicken Casserole',
      category: 'Chicken',
      area: 'Japanese',
      image: 'https://example.com/meal.jpg',
      source: 'https://example.com/recipe',
      instructions: 'Bake until golden.',
      ingredients: [{ name: 'Chicken', measure: '2 cups' }],
    }]);
  }, ':memory:', fetchImplementation);
});

test('recipe inspiration validates queries and reports upstream failures', async () => {
  await withApi(async (baseUrl) => {
    const missingQuery = await fetch(`${baseUrl}/api/inspiration?q=%20`);
    assert.equal(missingQuery.status, 400);

    const tooLongQuery = await fetch(`${baseUrl}/api/inspiration?q=${'a'.repeat(81)}`);
    assert.equal(tooLongQuery.status, 400);
  });

  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/inspiration?q=unknown`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
  }, ':memory:', async () => ({ ok: true, json: async () => ({ meals: null }) }));

  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/inspiration?q=pasta`);
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /inspiration service/);
  }, ':memory:', async () => {
    throw new Error('network failure');
  });
});

test('collections can be created, assigned recipes, updated, and deleted', async () => {
  await withApi(async (baseUrl) => {
    const initial = await (await fetch(`${baseUrl}/api/collections`)).json();
    assert.equal(initial.length, 4);

    const createResponse = await fetch(`${baseUrl}/api/collections`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Comfort food',
        description: 'Cozy meals for the weekend.',
        recipeIds: [1, 5],
      }),
    });
    const created = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.deepEqual(created.recipeIds, [1, 5]);

    const updateResponse = await fetch(`${baseUrl}/api/collections/${created.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Sunday favorites',
        description: '',
        recipeIds: [2],
      }),
    });
    const updated = await updateResponse.json();
    assert.equal(updateResponse.status, 200);
    assert.equal(updated.name, 'Sunday favorites');
    assert.deepEqual(updated.recipeIds, [2]);

    const deleteResponse = await fetch(`${baseUrl}/api/collections/${created.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleteResponse.status, 204);
    assert.equal((await (await fetch(`${baseUrl}/api/collections`)).json()).length, 4);

    await fetch(`${baseUrl}/api/recipes/1`, { method: 'DELETE' });
    const updatedCollections = await (await fetch(`${baseUrl}/api/collections`)).json();
    assert.deepEqual(updatedCollections.find((collection) => collection.id === 3).recipeIds, [5]);
  });
});

test('collection API rejects unknown recipes and duplicate selections', async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/collections`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Invalid', recipeIds: [1, 999] }),
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /selected recipe could not be found/);

    const emptyResponse = await fetch(`${baseUrl}/api/collections`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Empty', recipeIds: [] }),
    });
    assert.equal(emptyResponse.status, 400);
  });
});

test('recipe database retains changes after the API restarts', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cook-api-test-'));
  const databasePath = path.join(directory, 'recipes.sqlite');
  let createdId;
  let createdCollectionId;

  try {
    await withApi(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/recipes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      });
      createdId = (await response.json()).id;
      assert.equal(response.status, 201);

      const collectionResponse = await fetch(`${baseUrl}/api/collections`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Saved for later', recipeIds: [createdId] }),
      });
      createdCollectionId = (await collectionResponse.json()).id;
    }, databasePath);

    await withApi(async (baseUrl) => {
      const recipes = await (await fetch(`${baseUrl}/api/recipes`)).json();
      assert.equal(recipes.length, 7);
      assert.equal(recipes.find((recipe) => recipe.id === createdId)?.title, draft.title);
      const collections = await (await fetch(`${baseUrl}/api/collections`)).json();
      const savedCollection = collections.find((collection) => collection.id === createdCollectionId);
      assert.equal(savedCollection.name, 'Saved for later');
      assert.deepEqual(savedCollection.recipeIds, [createdId]);
    }, databasePath);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
