const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const seedRecipes = require('./seed');
const seedCollections = require('./seed-collections');

const defaultDatabasePath = path.resolve(__dirname, '../data/recipes.sqlite');

function createDatabase(databasePath = defaultDatabasePath) {
  if (databasePath !== ':memory:') {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      time INTEGER NOT NULL,
      rating REAL NOT NULL,
      steps TEXT NOT NULL,
      image TEXT NOT NULL,
      accent TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS collection_recipes (
      collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      PRIMARY KEY (collection_id, recipe_id)
    );
  `);

  const seeded = database.prepare('SELECT value FROM app_meta WHERE key = ?').get('seeded');
  if (!seeded) {
    const insertRecipe = database.prepare(`
      INSERT INTO recipes (id, title, category, time, rating, steps, image, accent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    database.exec('BEGIN');
    try {
      for (const recipe of seedRecipes) {
        insertRecipe.run(
          recipe.id,
          recipe.title,
          recipe.category,
          recipe.time,
          recipe.rating,
          JSON.stringify(recipe.steps),
          recipe.image,
          recipe.accent,
        );
      }
      database.prepare('INSERT INTO app_meta (key, value) VALUES (?, ?)').run('seeded', 'true');
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      database.close();
      throw error;
    }
  }

  const collectionsSeeded = database
    .prepare('SELECT value FROM app_meta WHERE key = ?')
    .get('collections_seeded');
  if (!collectionsSeeded) {
    const insertCollection = database.prepare(
      'INSERT INTO collections (id, name, description) VALUES (?, ?, ?)',
    );
    const insertRecipe = database.prepare(
      'INSERT INTO collection_recipes (collection_id, recipe_id, position) VALUES (?, ?, ?)',
    );
    const hasRecipe = database.prepare('SELECT id FROM recipes WHERE id = ?');
    database.exec('BEGIN');
    try {
      for (const collection of seedCollections) {
        insertCollection.run(collection.id, collection.name, collection.description);
        collection.recipeIds.forEach((recipeId, position) => {
          if (hasRecipe.get(recipeId)) {
            insertRecipe.run(collection.id, recipeId, position);
          }
        });
      }
      database
        .prepare('INSERT INTO app_meta (key, value) VALUES (?, ?)')
        .run('collections_seeded', 'true');
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      database.close();
      throw error;
    }
  }

  return database;
}

function toRecipe(row) {
  return {
    ...row,
    steps: JSON.parse(row.steps),
  };
}

function getCollections(database) {
  const recipeIdsByCollection = new Map();
  for (const row of database
    .prepare('SELECT collection_id, recipe_id FROM collection_recipes ORDER BY collection_id, position')
    .all()) {
    const recipeIds = recipeIdsByCollection.get(row.collection_id) ?? [];
    recipeIds.push(row.recipe_id);
    recipeIdsByCollection.set(row.collection_id, recipeIds);
  }

  return database
    .prepare('SELECT id, name, description FROM collections ORDER BY id')
    .all()
    .map((collection) => ({
      ...collection,
      recipeIds: recipeIdsByCollection.get(collection.id) ?? [],
    }));
}

function replaceCollectionRecipes(database, collectionId, recipeIds) {
  database.prepare('DELETE FROM collection_recipes WHERE collection_id = ?').run(collectionId);
  const insertRecipe = database.prepare(
    'INSERT INTO collection_recipes (collection_id, recipe_id, position) VALUES (?, ?, ?)',
  );
  recipeIds.forEach((recipeId, position) => {
    insertRecipe.run(collectionId, recipeId, position);
  });
}

module.exports = { createDatabase, getCollections, replaceCollectionRecipes, toRecipe };
