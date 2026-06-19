// src/controllers/crud-factory.ts
// Builds list/get/create/update/remove controllers for a governed entity. All
// mutations flow through the maker-checker engine (proposeOrExecute).
import type { Request, RequestHandler } from 'express';
import type { ZodType } from 'zod';

import {
  ChangeAction,
  type ChangeEntity,
} from '../../generated/prisma/client.js';
import { HTTP_STATUS_CODES } from '../config/constants.js';
import { asyncHandler } from '../middlewares/error-handler.js';
import validationMiddleware from '../middlewares/validation.js';
import { proposeOrExecute } from '../services/change-request/change-request.service.js';
import {
  type PaginationMeta,
  type PaginationParams,
  parsePagination,
  sendList,
  sendOk,
} from '../utils/http.js';
import { actorOf, ctxOf, respondToProposal } from './proposal-response.js';

interface CrudOptions<F> {
  createSchema: ZodType;
  entity: ChangeEntity;
  get: (id: string) => Promise<unknown>;
  label: string;
  list: (
    filters: F,
    pagination: PaginationParams,
  ) => Promise<{ data: unknown[]; meta: PaginationMeta }>;
  parseFilters: (req: Request) => F;
  summary?: (body: Record<string, unknown>) => string;
  updateSchema: ZodType;
}

export const makeCrud = <F>(opts: CrudOptions<F>) => {
  const list = asyncHandler(async (req, res) => {
    const result = await opts.list(
      opts.parseFilters(req),
      parsePagination(req.query),
    );
    sendList(res, `${opts.label}s retrieved`, result.data, result.meta);
  });

  const getOne = asyncHandler(async (req, res) => {
    const data = await opts.get(req.params.id ?? '');
    sendOk(res, `${opts.label} retrieved`, data);
  });

  const create: RequestHandler[] = [
    ...validationMiddleware.create(opts.createSchema),
    asyncHandler(async (req, res) => {
      const outcome = await proposeOrExecute(
        actorOf(req),
        {
          action: ChangeAction.CREATE,
          entity: opts.entity,
          payload: req.body,
          summary: opts.summary?.(req.body as Record<string, unknown>),
        },
        ctxOf(req),
      );
      respondToProposal(res, outcome, opts.label, HTTP_STATUS_CODES.CREATED);
    }),
  ];

  const update: RequestHandler[] = [
    ...validationMiddleware.update(opts.updateSchema),
    asyncHandler(async (req, res) => {
      const outcome = await proposeOrExecute(
        actorOf(req),
        {
          action: ChangeAction.UPDATE,
          entity: opts.entity,
          entityId: req.params.id ?? '',
          payload: req.body,
        },
        ctxOf(req),
      );
      respondToProposal(res, outcome, opts.label);
    }),
  ];

  const remove = asyncHandler(async (req, res) => {
    const outcome = await proposeOrExecute(
      actorOf(req),
      {
        action: ChangeAction.DELETE,
        entity: opts.entity,
        entityId: req.params.id ?? '',
        payload: {},
      },
      ctxOf(req),
    );
    respondToProposal(res, outcome, opts.label);
  });

  return { create, getOne, list, remove, update };
};
