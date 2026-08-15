/**
 * Hand-written OpenAPI 3.0 description of the REST v1 surface (rest.ts) —
 * kept in sync manually since the routes are a thin, deliberately small
 * hand-rolled router rather than generated from the tRPC procedures they
 * delegate to. Machine-readable so external tooling (Postman, codegen,
 * an AI agent) can discover and call the API without reading source.
 */
export function buildOpenApiSpec(baseUrl: string): Record<string, unknown> {
  const money = { type: 'integer', description: 'Minor currency units (e.g. cents)' }
  const errorResponse = {
    description: 'Error',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: { error: { type: 'string' } },
          required: ['error'],
        },
      },
    },
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'Redbird REST API',
      version: 'v1',
      description:
        'Storefront read/checkout surface plus admin catalog & inventory management. ' +
        'Order creation, checkout, and pricing delegate to the same server-side tRPC ' +
        'procedures the storefront app uses — no logic is duplicated here.',
    },
    servers: [{ url: `${baseUrl}/api/v1` }],
    components: {
      securitySchemes: {
        customerBearer: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Customer session token, obtained from /customers/login (tRPC).',
        },
        adminKey: {
          type: 'apiKey',
          in: 'header',
          name: 'x-admin-key',
          description: 'Master admin key — full access, bypasses staff roles.',
        },
        staffToken: {
          type: 'apiKey',
          in: 'header',
          name: 'x-staff-token',
          description: 'Staff session token, obtained from /staff/login (tRPC). Role-gated.',
        },
      },
    },
    paths: {
      '/products': {
        get: {
          summary: 'List active products',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 100 } },
            { name: 'offset', in: 'query', schema: { type: 'integer' } },
            {
              name: 'sort',
              in: 'query',
              schema: { enum: ['newest', 'price_asc', 'price_desc', 'name'] },
            },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/products/search': {
        get: {
          summary: 'Full-text product search',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 50 } },
          ],
          responses: { '200': { description: 'OK' }, '400': errorResponse },
        },
      },
      '/products/{slug}': {
        get: {
          summary: 'Get a product by slug',
          parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'OK' }, '404': errorResponse },
        },
      },
      '/categories': {
        get: { summary: 'List categories', responses: { '200': { description: 'OK' } } },
      },
      '/categories/{slug}': {
        get: {
          summary: 'Get a category (with its products) by slug',
          parameters: [
            { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 100 } },
            { name: 'offset', in: 'query', schema: { type: 'integer' } },
          ],
          responses: { '200': { description: 'OK' }, '404': errorResponse },
        },
      },
      '/brands': {
        get: { summary: 'List brands', responses: { '200': { description: 'OK' } } },
      },
      '/carts/{id}': {
        get: {
          summary: 'Get a cart',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'OK' }, '404': errorResponse },
        },
      },
      '/carts': {
        post: {
          summary: 'Create a cart',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    currency: { type: 'string' },
                    customerEmail: { type: 'string' },
                  },
                  required: ['currency'],
                },
              },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/carts/{id}/items': {
        post: {
          summary: 'Add a line item to a cart',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { variantId: { type: 'string' }, quantity: { type: 'integer' } },
                  required: ['variantId'],
                },
              },
            },
          },
          responses: { '200': { description: 'OK' }, '400': errorResponse },
        },
      },
      '/carts/{id}/items/{itemId}': {
        delete: {
          summary: 'Remove a line item from a cart',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'itemId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/orders/{number}': {
        get: {
          summary: 'Look up an order by its order number (guest tracking, public)',
          parameters: [{ name: 'number', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/checkout': {
        post: {
          summary: 'Create an order from a cart',
          requestBody: {
            content: {
              'application/json': {
                schema: { type: 'object', properties: { cartId: { type: 'string' } } },
              },
            },
          },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/customers/me': {
        get: {
          summary: "Get the authenticated customer's profile",
          security: [{ customerBearer: [] }],
          responses: { '200': { description: 'OK' }, '401': errorResponse },
        },
      },
      '/customers/me/orders': {
        get: {
          summary: "List the authenticated customer's orders",
          security: [{ customerBearer: [] }],
          responses: { '200': { description: 'OK' }, '401': errorResponse },
        },
      },
      '/admin/products': {
        get: {
          summary: 'List products (any status)',
          security: [{ adminKey: [] }, { staffToken: [] }],
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 100 } },
            { name: 'offset', in: 'query', schema: { type: 'integer' } },
            { name: 'status', in: 'query', schema: { enum: ['draft', 'active', 'archived'] } },
          ],
          responses: { '200': { description: 'OK' }, '401': errorResponse },
        },
        post: {
          summary: 'Create a product (with an initial variant)',
          security: [{ adminKey: [] }, { staffToken: [] }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    status: { enum: ['draft', 'active', 'archived'] },
                    variant: {
                      type: 'object',
                      properties: {
                        sku: { type: 'string' },
                        name: { type: 'string' },
                        priceAmount: money,
                        priceCurrency: { type: 'string' },
                      },
                    },
                  },
                  required: ['name', 'slug', 'variant'],
                },
              },
            },
          },
          responses: { '201': { description: 'Created' }, '401': errorResponse },
        },
      },
      '/admin/products/{id}': {
        get: {
          summary: 'Get a product by id',
          security: [{ adminKey: [] }, { staffToken: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'OK' }, '404': errorResponse },
        },
        patch: {
          summary: 'Update a product',
          security: [{ adminKey: [] }, { staffToken: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'OK' }, '401': errorResponse },
        },
        delete: {
          summary: 'Delete a product',
          security: [{ adminKey: [] }, { staffToken: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'OK' }, '401': errorResponse },
        },
      },
      '/admin/products/{id}/variants': {
        post: {
          summary: 'Add a variant to a product',
          security: [{ adminKey: [] }, { staffToken: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    sku: { type: 'string' },
                    name: { type: 'string' },
                    priceAmount: money,
                    priceCurrency: { type: 'string' },
                    inventoryQuantity: { type: 'integer' },
                  },
                  required: ['sku', 'name', 'priceAmount', 'priceCurrency'],
                },
              },
            },
          },
          responses: { '201': { description: 'Created' }, '401': errorResponse },
        },
      },
      '/admin/variants/{id}': {
        patch: {
          summary: 'Update a variant (name, SKU, price)',
          security: [{ adminKey: [] }, { staffToken: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'OK' }, '401': errorResponse },
        },
        delete: {
          summary: 'Delete a variant',
          security: [{ adminKey: [] }, { staffToken: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'OK' }, '401': errorResponse },
        },
      },
      '/admin/stock/{variantId}': {
        get: {
          summary: 'Get stock level for a variant',
          security: [{ adminKey: [] }, { staffToken: [] }],
          parameters: [
            { name: 'variantId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
        patch: {
          summary: 'Set or adjust stock for a variant',
          description: 'Pass `quantity` to set an absolute value, or `delta` to adjust relatively.',
          security: [{ adminKey: [] }, { staffToken: [] }],
          parameters: [
            { name: 'variantId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { quantity: { type: 'integer' }, delta: { type: 'integer' } },
                },
              },
            },
          },
          responses: { '200': { description: 'OK' }, '401': errorResponse },
        },
      },
    },
  }
}
