---
tags: [react, frontend, typescript, hooks, components]
applies_to: [src/ui/**]
priority: medium
token_budget: medium
owner: frontend-team
last_reviewed: 2026-05-07
---

# Skill: React Patterns

## Purpose

Reusable patterns for building React components in the AIEP frontend. Load this file for any frontend task.

## Applicability

Load when: writing React components, custom hooks, data fetching, state management, forms, or error handling in `src/ui/`.

---

## 1. Component Structure

Always follow this structure (enforced by ESLint):

```tsx
// 1. Type definitions at top
type PromptCardProps = {
  promptId: string;
  onDeploy: (id: string) => Promise<void>;
  readOnly?: boolean;
};

// 2. Named function component (not arrow for top-level)
function PromptCard({ promptId, onDeploy, readOnly = false }: PromptCardProps) {
  // 3. Hooks in dependency order
  const [isDirty, setIsDirty] = useState(false);
  const { data: prompt, isLoading, error } = usePrompt(promptId);

  // 4. Derived state (useMemo for expensive computations)
  const canDeploy = useMemo(
    () => !readOnly && !isDirty && prompt?.status === 'ready',
    [readOnly, isDirty, prompt?.status],
  );

  // 5. Stable callbacks (useCallback when passed as props)
  const handleDeploy = useCallback(async () => {
    await onDeploy(promptId);
  }, [onDeploy, promptId]);

  // 6. Effects last
  useEffect(() => {
    if (prompt) setIsDirty(false);
  }, [prompt?.version]);

  // 7. Early returns for loading/error states
  if (isLoading) return <PromptCardSkeleton />;
  if (error) return <ErrorBanner message="Failed to load prompt" />;
  if (!prompt) return null;

  // 8. Render
  return (
    <Card>
      <PromptContent content={prompt.content} />
      <Button onClick={handleDeploy} disabled={!canDeploy}>
        Deploy
      </Button>
    </Card>
  );
}

// 9. Export at bottom
export { PromptCard };
```

---

## 2. Custom Hooks

Every piece of reusable stateful logic goes into a hook. Hooks live in `src/ui/hooks/`.

```typescript
// Pattern: encapsulate query + derived state + actions
function usePrompt(promptId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['prompts', promptId],
    queryFn: () => promptApi.getById(promptId),
    staleTime: 30_000,
  });

  const deploy = useMutation({
    mutationFn: (versionId: string) => promptApi.deploy(promptId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts', promptId] });
    },
  });

  return {
    prompt: query.data,
    isLoading: query.isLoading,
    error: query.error,
    deploy: deploy.mutate,
    isDeploying: deploy.isPending,
  };
}
```

### Hook Rules

- Name starts with `use`
- Return a consistent shape — don't change the return signature based on state
- Encapsulate loading + error + data together (never split across separate hooks for the same resource)
- Keep hooks focused on a single resource or concern

---

## 3. Data Fetching with TanStack Query

Use TanStack Query (React Query) for all server state:

```typescript
// Query keys: hierarchical array — enables precise invalidation
const queryKeys = {
  prompts: ['prompts'] as const,
  prompt: (id: string) => ['prompts', id] as const,
  promptVersions: (id: string) => ['prompts', id, 'versions'] as const,
};

// Always define staleTime — default is 0 (always stale)
const query = useQuery({
  queryKey: queryKeys.prompt(promptId),
  queryFn: () => promptApi.getById(promptId),
  staleTime: 60_000,       // 1 minute
  gcTime: 5 * 60_000,      // 5 minutes (formerly cacheTime)
});

// Optimistic updates for mutations
const mutation = useMutation({
  mutationFn: promptApi.update,
  onMutate: async (variables) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.prompt(variables.id) });
    const previous = queryClient.getQueryData(queryKeys.prompt(variables.id));
    queryClient.setQueryData(queryKeys.prompt(variables.id), variables);
    return { previous };
  },
  onError: (err, variables, context) => {
    queryClient.setQueryData(queryKeys.prompt(variables.id), context?.previous);
  },
  onSettled: (_, __, variables) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.prompt(variables.id) });
  },
});
```

---

## 4. State Management

### Local State: `useState` and `useReducer`

- `useState` for simple independent values
- `useReducer` for complex state with multiple related fields or transitions

```typescript
// Use useReducer when state has multiple related fields
type EditorState = {
  content: string;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
};

type EditorAction =
  | { type: 'CHANGE_CONTENT'; content: string }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; savedAt: Date }
  | { type: 'SAVE_ERROR' };

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'CHANGE_CONTENT':
      return { ...state, content: action.content, isDirty: true };
    case 'SAVE_START':
      return { ...state, isSaving: true };
    case 'SAVE_SUCCESS':
      return { ...state, isSaving: false, isDirty: false, lastSavedAt: action.savedAt };
    case 'SAVE_ERROR':
      return { ...state, isSaving: false };
  }
}
```

### Global State: Zustand

```typescript
// src/ui/store/useAuthStore.ts
type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
};

const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        isAuthenticated: false,
        login: async (credentials) => {
          const user = await authApi.login(credentials);
          set({ user, isAuthenticated: true });
        },
        logout: () => set({ user: null, isAuthenticated: false }),
      }),
      { name: 'auth-store' },
    ),
  ),
);
```

---

## 5. Error Boundaries

Every route-level component must be wrapped in an error boundary:

```tsx
// src/ui/components/ErrorBoundary.tsx
function ErrorBoundary({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <ReactErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div role="alert">
          <p>Something went wrong: {error.message}</p>
          <button onClick={resetErrorBoundary}>Try again</button>
        </div>
      )}
    >
      {children}
    </ReactErrorBoundary>
  );
}

// Usage in router
function PromptEditorRoute() {
  return (
    <ErrorBoundary fallback={<PromptEditorError />}>
      <PromptEditor />
    </ErrorBoundary>
  );
}
```

---

## 6. Performance

```typescript
// Memoize expensive renders
const PromptList = memo(function PromptList({ prompts }: { prompts: Prompt[] }) {
  return <ul>{prompts.map(p => <PromptCard key={p.id} promptId={p.id} />)}</ul>;
});

// Virtualize long lists (> 50 items)
import { useVirtualizer } from '@tanstack/react-virtual';

// Lazy load routes
const PromptEditor = lazy(() => import('./PromptEditor'));
```

---

## Anti-Patterns

| Anti-Pattern | Correct Pattern |
|---|---|
| Anonymous arrow components for top-level | Named function components |
| `useEffect` for derived state | Compute during render or `useMemo` |
| Direct state mutation `state.count++` | `setState(s => ({ ...s, count: s.count + 1 }))` |
| Multiple `useState` for related fields | `useReducer` |
| No loading/error state in async components | Always show loading + error states |
| Calling hooks conditionally | Hooks always called at top level |
| Large components > 200 lines | Extract sub-components |

---

## Checklist

Before submitting a frontend PR:
- [ ] Component has loading and error states
- [ ] Custom hook used for reusable logic
- [ ] Route component wrapped in error boundary
- [ ] Lists > 50 items are virtualized
- [ ] No inline styles
- [ ] Accessible: semantic HTML, ARIA labels where needed
- [ ] Tests cover happy path and error state
