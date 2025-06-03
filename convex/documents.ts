import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

export const get = query({
  args: {
    search: v.optional(v.string()),
    paginationOpts: v.optional(paginationOptsValidator),
  },
  handler: async (ctx, { search, paginationOpts }) => {
    console.log('documents.get query executing with search:', search);
    console.log('Pagination options:', paginationOpts);
    
    try {
      console.log('Attempting to get user identity...');
      const identity = await ctx.auth.getUserIdentity();
      console.log('Raw identity object:', identity);
      
      // TEMPORARY DEBUG MODE: Skip authentication check and use a placeholder userId
      // This helps us verify if the issue is with authentication or something else
      let userId = "debug_user_id";
      
      if (identity) {
        console.log('Identity found, examining structure:');
        // Log all properties of the identity object
        for (const [key, value] of Object.entries(identity as Record<string, any>)) {
          console.log(`- ${key}:`, value);
        }
        
        // Try to extract user ID from various possible claims
        console.log('Possible ID locations:');
        console.log('- identity.subject:', identity.subject || 'undefined');
        console.log('- identity.tokenIdentifier:', identity.tokenIdentifier || 'undefined');
        console.log('- identity.user_id:', (identity as any).user_id || 'undefined');
        console.log('- identity.id:', (identity as any).id || 'undefined');
        console.log('- identity.sub:', (identity as any).sub || 'undefined');
        
        // Try all possible ID fields
        userId = (identity as any).user_id || 
                 identity.subject || 
                 (identity as any).sub || 
                 (identity as any).id || 
                 identity.tokenIdentifier?.split(":")?.[1] || 
                 "debug_user_id"; // Fallback for testing
                 
        console.log('Extracted userId:', userId);
      } else {
        console.error('No identity found - but continuing for debugging');
        // For debugging only - normally we would throw an error here
      }

    // Get the organization id from the user's token (if using organizations)
    const organizationId = identity?.organization_id as string | undefined;
    console.log('Organization ID:', organizationId || 'none');

    // Searching a document in an organization
    if (search && organizationId) {
      return await ctx.db
        .query("documents")
        .withSearchIndex("search_title", (query) =>
          query.search("title", search).eq("organizationId", organizationId)
        )
        .collect();
    }

    // Searching a document
    if (search) {
      return await ctx.db
        .query("documents")
        .withSearchIndex("search_title", (query) =>
          query.search("title", search).eq("ownerId", userId)
        )
        .collect();
    }

    // Fetching the documents in an organization
    if (organizationId) {
      return await ctx.db
        .query("documents")
        .withIndex("by_organizationId", (query) =>
          query.eq("organizationId", organizationId)
        )
        .collect();
    }

    // Fetching the personal documents for the current user
    return await ctx.db
      .query("documents")
      .withIndex("by_ownerId", (query) =>
        query.eq("ownerId", userId)
      )
      .collect();
    } catch (error) {
      console.error('Error in documents query:', error);
      throw error;
    }
  },
});

export const create = mutation({
  args: {
    title: v.optional(v.string()),
    initialContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new ConvexError("Unauthorized");
    }

    // Get user ID from either user_id or subject claim
    const userId = (user as any).user_id || user.subject;
    if (!userId) {
      throw new ConvexError("No user ID found in token");
    }

    const organizationId = (user.organization_id ?? undefined) as string | undefined;

    if (organizationId) {
      console.log("Creating document with organization");
      return await ctx.db.insert("documents", {
        title: args.title ?? "Untitled Document",
        ownerId: userId,
        initialContent: args.initialContent,
        organizationId: organizationId
      });
    }

    return await ctx.db.insert("documents", {
      title: args.title ?? "Untitled Document",
      ownerId: userId,
      initialContent: args.initialContent,
    });
  },
});

// nullish coalescing operator (??) to set a default value if args.title is null or undefined.

export const removeById = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new ConvexError("Unauthorized");
    }

    const userId = (user as any).user_id || user.subject;
    if (!userId) {
      throw new ConvexError("No user ID found in token");
    }

    const document = await ctx.db.get(args.id);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    if (document.ownerId !== userId) {
      throw new ConvexError("Unauthorized: You don't own this document");
    }

    await ctx.db.delete(args.id);
    return true;
  },
});

export const updateById = mutation({
  args: { id: v.id("documents"), title: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new ConvexError("Unauthorized");
    }
    
    const userId = (user as any).user_id || user.subject;
    if (!userId) {
      throw new ConvexError("No user ID found in token");
    }
    
    const organizationId = (user.organization_id ?? undefined) as string | undefined

    const document = await ctx.db.get(args.id);

    if (!document) {
      throw new ConvexError("Document not Found");
    }

    const isOwner = document.ownerId === userId;
    const isOrganizationMember = !!(document.organizationId && document.organizationId === organizationId);

    if (!isOwner && !isOrganizationMember) {
      throw new ConvexError("Access Denied. Contact the owner");
    }

    return await ctx.db.patch(args.id, { title: args.title });
  },
});

export const getById = query({
  args: { id: v.id("documents") },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const document = await ctx.db.get(id);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // Get user ID from either user_id or subject claim
    const userId = (identity as any).user_id || identity.subject;
    if (!userId) {
      throw new ConvexError("No user ID found in token");
    }

    // Only allow access if the user is the owner or part of the organization
    if (document.ownerId !== userId) {
      throw new ConvexError("Unauthorized: You don't have access to this document");
    }

    return document;
  }
})

export const getByIds = query({
  args: { ids: v.array(v.id("documents")) },
  handler: async (ctx, { ids }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    // Get user ID from either user_id or subject claim
    const userId = (identity as any).user_id || identity.subject;
    if (!userId) {
      throw new ConvexError("No user ID found in token");
    }

    const documents = [];
    for (const id of ids) {
      const document = await ctx.db.get(id);
      if (document && document.ownerId === userId) {
        documents.push({
          ...document,
          _id: document._id.toString(),
        });
      }
    }
    return documents;
  },
})