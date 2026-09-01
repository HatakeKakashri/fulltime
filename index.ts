const server = Bun.serve({
  port: 3001,
  routes: {
    "/": () => new Response('Bun!'),
  }
});

console.log(`Listening on ${server.url}`);
