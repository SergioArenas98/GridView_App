import type { RepositorySource } from '../../src/identity/catalog/model';
export function loadCorpus(): Omit<RepositorySource, 'semanticHash'>[];
