import type { Get, UnionToIntersection } from 'type-fest';
import type { paths as payiiPaths } from './schema-payii';
import type { paths as authPaths } from './schema-auth';
import type { paths as userPaths } from './schema-user';
export type paths = authPaths & userPaths & payiiPaths;
export type UrlPaths = keyof paths;

export type HttpMethods = Extract<keyof UnionToIntersection<paths[keyof paths]>, string>;

export type HttpMethodsFilteredByPath<Path extends UrlPaths> = HttpMethods &
  keyof UnionToIntersection<paths[Path]>;

export type RequestParameters<Path extends UrlPaths, Method extends HttpMethods> = Get<
  paths,
  `${Path}.${Method}.parameters.query`
>;

export type RequestData<Path extends UrlPaths, Method extends HttpMethods> = Get<
  paths,
  `${Path}.${Method}.requestBody.content.application/json`
>;

export type ResponseData<Path extends UrlPaths, Method extends HttpMethods> = Get<
  paths,
  `${Path}.${Method}.responses.200.content.application/json`
>;