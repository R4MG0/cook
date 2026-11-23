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

function sessionCookie(response) {
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie);
  return setCookie.split(';')[0];
}

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

test('accounts can register, log in, inspect, and end sessions', async () => {
  await withApi(async (baseUrl) => {
    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Jamie Cook',
        email: 'Jamie@example.com',
        password: 'a-secure-test-password',
      }),
    });
    const registered = await registration.json();
    assert.equal(registration.status, 201);
    assert.deepEqual(Object.keys(registered.user).sort(), ['email', 'id', 'name']);
    const cookie = sessionCookie(registration);
    assert.match(registration.headers.get('set-cookie'), /HttpOnly/);
    assert.match(registration.headers.get('set-cookie'), /SameSite=Lax/);

    const session = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie },
    });
    assert.deepEqual(await session.json(), { user: registered.user });

    const duplicate = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Another Jamie',
        email: 'JAMIE@example.com',
        password: 'another-secure-password',
      }),
    });
    assert.equal(duplicate.status, 409);

    const wrongPassword = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'jamie@example.com', password: 'incorrect-password' }),
    });
    assert.equal(wrongPassword.status, 401);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'JAMIE@example.com', password: 'a-secure-test-password' }),
    });
    assert.equal(login.status, 200);
    const loginCookie = sessionCookie(login);
    assert.deepEqual(await (await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie: loginCookie },
    })).json(), { user: registered.user });

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie: loginCookie },
    });
    assert.equal(logout.status, 204);
    assert.deepEqual(await (await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie: loginCookie },
    })).json(), { user: null });
  });
});

test('different signed-in users can share experiences on a recipe', async () => {
  await withApi(async (baseUrl) => {
    const unauthorized = await fetch(`${baseUrl}/api/recipes/1/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'I tried this at home.' }),
    });
    assert.equal(unauthorized.status, 401);

    const firstRegistration = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Alex',
        email: 'alex@example.com',
        password: 'first-secure-password',
      }),
    });
    const firstCookie = sessionCookie(firstRegistration);
    const firstComment = await fetch(`${baseUrl}/api/recipes/1/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: firstCookie },
      body: JSON.stringify({ body: 'I added extra lemon.', author: 'Not Alex' }),
    });
    assert.equal(firstComment.status, 201);
    const firstCommentData = await firstComment.json();
    assert.equal(firstCommentData.id, 1);
    assert.equal(firstCommentData.body, 'I added extra lemon.');
    assert.match(firstCommentData.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(firstCommentData.author, 'Alex');

    const secondRegistration = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Riley',
        email: 'riley@example.com',
        password: 'second-secure-password',
      }),
    });
    const secondCookie = sessionCookie(secondRegistration);
    const secondComment = await fetch(`${baseUrl}/api/recipes/1/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: secondCookie },
      body: JSON.stringify({ body: 'Great for meal prep.' }),
    });
    assert.equal(secondComment.status, 201);
    assert.equal((await secondComment.json()).author, 'Riley');

    const commentsResponse = await fetch(`${baseUrl}/api/recipes/1/comments`);
    const comments = await commentsResponse.json();
    assert.equal(commentsResponse.status, 200);
    assert.deepEqual(comments.map(({ author, body }) => ({ author, body })), [
      { author: 'Riley', body: 'Great for meal prep.' },
      { author: 'Alex', body: 'I added extra lemon.' },
    ]);
    assert.equal('email' in comments[0], false);
  });
});

test('account and comment inputs enforce their validation limits', async () => {
  await withApi(async (baseUrl) => {
    const invalidEmail = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Jamie', email: 'not-an-email', password: 'a-secure-password' }),
    });
    assert.equal(invalidEmail.status, 400);

    const shortPassword = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Jamie', email: 'jamie@example.com', password: 'short' }),
    });
    assert.equal(shortPassword.status, 400);

    const missingRecipe = await fetch(`${baseUrl}/api/recipes/999/comments`);
    assert.equal(missingRecipe.status, 404);

    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Jamie',
        email: 'jamie@example.com',
        password: 'a-secure-password',
      }),
    });
    const cookie = sessionCookie(registration);
    for (const body of ['   ', 'x'.repeat(2001)]) {
      const response = await fetch(`${baseUrl}/api/recipes/1/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ body }),
      });
      assert.equal(response.status, 400);
    }
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
