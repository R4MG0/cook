# Cook

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.1.0.

## Development server and API

The app uses a local Node.js API backed by SQLite to save recipes, their steps, collections, and each collection's selected recipes. Node.js 22.5 or later is required.

Install dependencies and start both the API and Angular app with:

```bash
npm install
npm start
```

Open `http://localhost:4200/`. Recipe and collection data is stored in `data/recipes.sqlite` and survives app restarts. The database is created and seeded with sample recipes and starter collections the first time the API starts.

To run the API by itself, use `npm run server`. The API listens on `http://127.0.0.1:3000/`; Angular proxies `/api` requests to it during development.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running tests

Run the Angular unit tests with the [Vitest](https://vitest.dev/) test runner:

```bash
npm test
```

Run API integration tests with:

```bash
npm run test:server
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
