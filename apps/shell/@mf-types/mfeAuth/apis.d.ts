
    export type RemoteKeys = 'mfeAuth/routes';
    type PackageType<T> = T extends 'mfeAuth/routes' ? typeof import('mfeAuth/routes') :any;