import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { 
  createReceiptInputSchema, 
  updateReceiptInputSchema, 
  getReceiptByIdInputSchema, 
  deleteReceiptInputSchema, 
  searchReceiptsInputSchema 
} from './schema';
import { createReceipt } from './handlers/create_receipt';
import { getReceipts } from './handlers/get_receipts';
import { getReceiptById } from './handlers/get_receipt_by_id';
import { updateReceipt } from './handlers/update_receipt';
import { deleteReceipt } from './handlers/delete_receipt';
import { searchReceipts } from './handlers/search_receipts';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),
  
  // Create a new receipt with items
  createReceipt: publicProcedure
    .input(createReceiptInputSchema)
    .mutation(({ input }) => createReceipt(input)),
  
  // Get all receipts with their items
  getReceipts: publicProcedure
    .query(() => getReceipts()),
  
  // Get a specific receipt by ID with its items
  getReceiptById: publicProcedure
    .input(getReceiptByIdInputSchema)
    .query(({ input }) => getReceiptById(input)),
  
  // Update an existing receipt and its items
  updateReceipt: publicProcedure
    .input(updateReceiptInputSchema)
    .mutation(({ input }) => updateReceipt(input)),
  
  // Delete a receipt and all its items
  deleteReceipt: publicProcedure
    .input(deleteReceiptInputSchema)
    .mutation(({ input }) => deleteReceipt(input)),
  
  // Search receipts by various criteria
  searchReceipts: publicProcedure
    .input(searchReceiptsInputSchema)
    .query(({ input }) => searchReceipts(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();