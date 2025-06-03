"use client"

import { Navbar } from "./navbar"
import { TemplatesGallery } from "./templatesGallery"
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { DocumentsTable } from "./documentsTable"
import { useSearchParam } from "@/hooks/use-search-params"
import { useUser, useAuth } from "@clerk/nextjs"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const { isLoaded: isUserLoaded, isSignedIn } = useUser()
  const { getToken } = useAuth()
  const [search] = useSearchParam()
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      if (isUserLoaded) {
        if (!isSignedIn) {
          router.push('/sign-in')
        } else {
          // Verify we have a valid token
          const token = await getToken({ template: "convex" })
          if (token) {
            setIsAuthenticated(true)
          } else {
            console.error("Failed to get authentication token")
          }
        }
      }
    }
    checkAuth()
  }, [isUserLoaded, isSignedIn, router, getToken])

  // Run the query when authenticated
  const paginationOpts = {
    cursor: null,
    numItems: 10
  };

  const queryResult = useQuery(
    api.documents.get,
    isAuthenticated ? { search, paginationOpts } : 'skip'
  );
  
  const documents = queryResult || [];
  const isLoading = !isUserLoaded || !isAuthenticated || queryResult === undefined;
  
  // Add debug logging
  useEffect(() => {
    console.log('Auth state:', { isUserLoaded, isAuthenticated });
    console.log('Documents:', documents);
  }, [isUserLoaded, isAuthenticated, documents]);

  if (!isUserLoaded || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="fixed top-0 left-0 right-0 z-10 h-16 bg-white p-4">
        <Navbar />
      </div>
      <div className="mt-16">
        <TemplatesGallery />
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No documents found</p>
            <p className="text-sm text-muted-foreground mt-2">Create a new document to get started</p>
          </div>
        ) : (
          <DocumentsTable
            documents={documents}
            loadMore={() => {}}
            status={isLoading ? 'LoadingFirstPage' : 'Exhausted'}
          />
        )}
      </div>
      <footer className="flex w-full items-center justify-center mb-2">
        <p className="text-sm text-muted-foreground">
          Designed and Developed by{' '}
          <a
            className="hover:underline"
            href="https://github.com/yash27007"
            target="_blank"
            rel="noopener noreferrer"
          >
            Yashwanth Aravind
          </a>
        </p>
      </footer>
    </div>
  )
}