"use client";

// File-import dialogs (DMS style: everything in a dialog, no separate page).
// Shared three-stage body - pick a file, review the parsed preview with
// per-row problems, confirm - specialized for voters and candidates. Nothing
// is written until the final confirmation, and writes ride maker-checker.
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileUp,
  UsersRound,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import type { CandidateImportPreview, ImportPreview, ImportRowError } from "@/types/api";

import {
  buildCandidateTemplateCsv,
  buildTemplateCsv,
  isAcceptedImportFile,
} from "@/components/voters/import-logic";
import { ImportProgress } from "@/components/console/import-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Modal } from "@/components/ui/modal";
import {
  useBulkCreateCandidatesMutation,
  useBulkCreateVotersMutation,
  usePreviewCandidateImportMutation,
  usePreviewVoterImportMutation,
} from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

const PREVIEW_ROW_CAP = 30;

const downloadCsv = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

interface PreviewShape {
  errors: ImportRowError[];
  ignoredColumns: string[];
  summary: { invalid: number; total: number; valid: number };
}

/** The stages shared by both dialogs (generic over the preview row type). */
function ImportBody({
  columnsHint,
  fileName,
  onPickFile,
  onTemplate,
  parsing,
  preview,
  renderRows,
}: {
  columnsHint: string;
  fileName: null | string;
  onPickFile: (file: File | undefined) => void;
  onTemplate: () => void;
  parsing: boolean;
  preview: null | PreviewShape;
  renderRows: null | React.ReactNode;
}) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      {/* Stage 1 - the file */}
      <div className="rounded-lg border border-dashed border-border p-4">
        <p className="text-sm font-medium">{fileName ?? "Choose a CSV or Excel file"}</p>
        <p className="mt-1 text-xs text-muted-foreground">{columnsHint}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button loading={parsing} onClick={() => fileInput.current?.click()} size="sm" variant="brand">
            <FileUp className="size-4" /> {fileName ? "Choose another" : "Choose file"}
          </Button>
          <Button onClick={onTemplate} size="sm" variant="outline">
            <Download className="size-4" /> Template
          </Button>
        </div>
        <input
          accept=".csv,.xlsx"
          className="hidden"
          onChange={(e) => {
            onPickFile(e.target.files?.[0]);
            e.target.value = "";
          }}
          ref={fileInput}
          type="file"
        />
      </div>

      {/* Stage 2 - the preview */}
      {preview && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-border px-2 py-2">
              <p className="text-[11px] text-muted-foreground">Rows</p>
              <p className="font-mono text-lg font-semibold tabular-nums">
                {preview.summary.total}
              </p>
            </div>
            <div className="rounded-lg border border-border px-2 py-2">
              <p className="text-[11px] text-muted-foreground">Ready</p>
              <p className="font-mono text-lg font-semibold text-success tabular-nums">
                {preview.summary.valid}
              </p>
            </div>
            <div className="rounded-lg border border-border px-2 py-2">
              <p className="text-[11px] text-muted-foreground">Problems</p>
              <p className="font-mono text-lg font-semibold text-destructive tabular-nums">
                {preview.summary.invalid}
              </p>
            </div>
          </div>
          {preview.ignoredColumns.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Ignored columns: {preview.ignoredColumns.join(", ")}
            </p>
          )}

          {preview.errors.length > 0 && (
            <div className="rounded-lg border border-border">
              <p className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-xs font-semibold">
                <AlertTriangle className="size-3.5 text-warning" /> Rows needing attention
                <span className="ml-auto font-normal text-muted-foreground">skipped on import</span>
              </p>
              <ul className="max-h-40 divide-y divide-border overflow-y-auto">
                {preview.errors.map((error, index) => (
                  <li
                    className="flex items-baseline gap-2 px-3 py-1.5 text-xs"
                    key={`${String(error.row)}-${error.field}-${String(index)}`}
                  >
                    <span className="shrink-0 font-mono text-muted-foreground">
                      Row {error.row}
                    </span>
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      <Badge className="mr-1 align-middle" variant="outline">
                        {error.field}
                      </Badge>
                      {error.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {renderRows}
        </>
      )}
    </div>
  );
}

function ReadyRows({ children, count }: { children: React.ReactNode; count: number }) {
  if (count === 0) return null;
  return (
    <div className="rounded-lg border border-border">
      <p className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-xs font-semibold">
        <CheckCircle2 className="size-3.5 text-success" /> Ready to import
      </p>
      <ul className="max-h-40 divide-y divide-border overflow-y-auto">{children}</ul>
      {count > PREVIEW_ROW_CAP && (
        <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
          …and {count - PREVIEW_ROW_CAP} more rows.
        </p>
      )}
    </div>
  );
}

export function VoterImportDialog({
  onClose,
  onDone,
  open,
}: {
  onClose: () => void;
  /** Called after a successful import (e.g. to point at the roll tab). */
  onDone?: () => void;
  open: boolean;
}) {
  const [fileName, setFileName] = useState<null | string>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Set when the server takes the import in the background; the dialog then
  // shows progress instead of the preview.
  const [batchId, setBatchId] = useState<null | string>(null);
  const [previewImport, { isLoading: parsing }] = usePreviewVoterImportMutation();
  const [bulkCreate, { isLoading: registering }] = useBulkCreateVotersMutation();

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    if (!isAcceptedImportFile(file.name)) {
      toast.error("Upload a .csv or .xlsx file");
      return;
    }
    setFileName(file.name);
    try {
      const res = await previewImport(file).unwrap();
      setPreview(res.data);
    } catch (error) {
      setFileName(null);
      setPreview(null);
      toast.error(getApiErrorMessage(error, "Could not read that file"));
    }
  };

  const register = async () => {
    if (!preview) return;
    setConfirming(false);
    try {
      const res = await bulkCreate({ voters: preview.rows }).unwrap();

      // A large register is written in the background, so the response is a
      // batch to watch rather than a result. Claiming success here would tell
      // the admin the rows are in while they are still being written - and
      // would hide any that fail.
      if (res.data?.queued) {
        setBatchId(res.data.id);
        return;
      }

      toast.success(
        res.pending
          ? "Import submitted for super-admin approval"
          : `${String(preview.rows.length)} voters registered`,
      );
      onClose();
      onDone?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Import failed"));
    }
  };

  /** Close once the background import has finished, reporting the outcome. */
  const onImportFinished = (status: string) => {
    if (status === "FAILED") {
      toast.error("The import failed. See the details above.");
      return;
    }
    toast.success(
      status === "PARTIAL"
        ? "Import finished with some rows skipped"
        : "Import finished",
    );
    onDone?.();
  };

  return (
    <>
      <Modal
        description="Upload a spreadsheet, review the parsed rows, then register the clean ones."
        onClose={onClose}
        open={open}
        title="Import voters"
      >
        <div className="space-y-4">
          {/* Once the server takes the import in the background, the preview
              is history - what matters is how far it has got. */}
          {batchId ? (
            <ImportProgress batchId={batchId} onFinished={onImportFinished} />
          ) : (
            <ImportBody
            columnsHint='Needs a name and a voter ID column; phone and email are optional. Headings like "Full Name" or "Index Number" are recognized automatically. Large files are imported in the background.'
            fileName={fileName}
            onPickFile={(file) => void onPickFile(file)}
            onTemplate={() => {
              downloadCsv(buildTemplateCsv(), "voters-template.csv");
            }}
            parsing={parsing}
            preview={preview}
            renderRows={
              preview && (
                <ReadyRows count={preview.rows.length}>
                  {preview.rows.slice(0, PREVIEW_ROW_CAP).map((row) => (
                    <li className="px-3 py-1.5" key={row.voterId}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-xs font-medium">{row.name}</span>
                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                          {row.voterId}
                        </span>
                      </div>
                    </li>
                  ))}
                </ReadyRows>
              )
            }
            />
          )}
          {preview && !batchId && (
            <Button
              className="w-full"
              disabled={preview.rows.length === 0}
              loading={registering}
              onClick={() => {
                setConfirming(true);
              }}
              variant="brand"
            >
              <UsersRound className="size-4" /> Register {preview.rows.length} voters
            </Button>
          )}
        </div>
      </Modal>
      <ConfirmationDialog
        confirmText="Register"
        description={`${String(preview?.rows.length ?? 0)} voters will be registered${
          preview?.summary.invalid
            ? `; ${String(preview.summary.invalid)} problem rows are skipped`
            : ""
        }.`}
        onConfirm={register}
        onOpenChange={(isOpen) => {
          if (!isOpen) setConfirming(false);
        }}
        open={confirming}
        title="Register these voters?"
      />
    </>
  );
}

export function CandidateImportDialog({
  electionId,
  onClose,
  open,
}: {
  electionId: string;
  onClose: () => void;
  open: boolean;
}) {
  const [fileName, setFileName] = useState<null | string>(null);
  const [preview, setPreview] = useState<CandidateImportPreview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [previewImport, { isLoading: parsing }] = usePreviewCandidateImportMutation();
  const [bulkCreate, { isLoading: registering }] = useBulkCreateCandidatesMutation();

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    if (!isAcceptedImportFile(file.name)) {
      toast.error("Upload a .csv or .xlsx file");
      return;
    }
    setFileName(file.name);
    try {
      const res = await previewImport({ electionId, file }).unwrap();
      setPreview(res.data);
    } catch (error) {
      setFileName(null);
      setPreview(null);
      toast.error(getApiErrorMessage(error, "Could not read that file"));
    }
  };

  const register = async () => {
    if (!preview) return;
    setConfirming(false);
    try {
      const res = await bulkCreate({ candidates: preview.rows }).unwrap();
      toast.success(
        (res as { pending?: boolean }).pending
          ? "Import submitted for super-admin approval"
          : `${String(preview.rows.length)} candidates nominated`,
      );
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Import failed"));
    }
  };

  return (
    <>
      <Modal
        description="Upload nominations for this election; each row's portfolio is matched by name. Photos and manifesto PDFs are added per candidate afterwards."
        onClose={onClose}
        open={open}
        title="Import candidates"
      >
        <div className="space-y-4">
          <ImportBody
            columnsHint='Needs a candidate name, a portfolio column, and an email or phone per row (it becomes their sign-in account); nickname, party symbol, and manifesto text are optional. Headings like "Candidate" or "Position" are recognized automatically. Up to 1000 rows.'
            fileName={fileName}
            onPickFile={(file) => void onPickFile(file)}
            onTemplate={() => {
              downloadCsv(buildCandidateTemplateCsv(), "candidates-template.csv");
            }}
            parsing={parsing}
            preview={preview}
            renderRows={
              preview && (
                <ReadyRows count={preview.rows.length}>
                  {preview.rows.slice(0, PREVIEW_ROW_CAP).map((row) => (
                    <li className="px-3 py-1.5" key={`${row.portfolioId}-${row.name}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-xs font-medium">{row.name}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {row.portfolioName}
                        </span>
                      </div>
                    </li>
                  ))}
                </ReadyRows>
              )
            }
          />
          {preview && (
            <Button
              className="w-full"
              disabled={preview.rows.length === 0}
              loading={registering}
              onClick={() => {
                setConfirming(true);
              }}
              variant="brand"
            >
              <UsersRound className="size-4" /> Nominate {preview.rows.length} candidates
            </Button>
          )}
        </div>
      </Modal>
      <ConfirmationDialog
        confirmText="Nominate"
        description={`${String(preview?.rows.length ?? 0)} candidates will be nominated${
          preview?.summary.invalid
            ? `; ${String(preview.summary.invalid)} problem rows are skipped`
            : ""
        }.`}
        onConfirm={register}
        onOpenChange={(isOpen) => {
          if (!isOpen) setConfirming(false);
        }}
        open={confirming}
        title="Nominate these candidates?"
      />
    </>
  );
}
