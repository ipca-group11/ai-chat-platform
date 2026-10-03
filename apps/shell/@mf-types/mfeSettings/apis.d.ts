
    export type RemoteKeys = 'mfeSettings/routes';
    type PackageType<T> = T extends 'mfeSettings/routes' ? typeof import('mfeSettings/routes') :any;