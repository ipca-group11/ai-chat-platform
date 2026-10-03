
    export type RemoteKeys = 'mfeChat/routes' | 'mfeChat/remote-entry';
    type PackageType<T> = T extends 'mfeChat/remote-entry' ? typeof import('mfeChat/remote-entry') :T extends 'mfeChat/routes' ? typeof import('mfeChat/routes') :any;