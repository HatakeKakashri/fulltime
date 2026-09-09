import { useEffect, useRef, useState } from "react";
import { trpc } from "../trpc/client";
import { invalidateAllQueries } from "../trpc/utils";

export function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const utils = trpc.useUtils();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuItemRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const resetWorldMutation = trpc.season.resetWorld.useMutation({
    onSuccess: async () => {
      await invalidateAllQueries(utils);
      setShowConfirmDialog(false);
      setIsOpen(false);
    },
  });

  // Click-outside handler for the dropdown menu
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation for the dropdown menu
  useEffect(() => {
    if (!isOpen) return;
    function handleMenuKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        menuItemRef.current?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        menuItemRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleMenuKeyDown);
    return () => document.removeEventListener("keydown", handleMenuKeyDown);
  }, [isOpen]);

  // Focus the menu item when the menu opens
  useEffect(() => {
    if (isOpen) {
      menuItemRef.current?.focus();
    }
  }, [isOpen]);

  // Focus the "No" button when the dialog opens; trap escape to close + return focus
  useEffect(() => {
    if (!showConfirmDialog) return;
    cancelButtonRef.current?.focus();

    function handleDialogKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowConfirmDialog(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleDialogKeyDown);
    return () => document.removeEventListener("keydown", handleDialogKeyDown);
  }, [showConfirmDialog]);

  return (
    <div className="relative" ref={menuRef}>
      {/* Gear icon button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-slate-300 hover:text-white transition-colors p-2"
        aria-label="Settings"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <path
            fillRule="evenodd"
            d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20"
          role="menu"
        >
          <div className="py-1">
            <button
              ref={menuItemRef}
              type="button"
              role="menuitem"
              onClick={() => {
                setShowConfirmDialog(true);
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              Reset World
            </button>
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirmDialog && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => {
              setShowConfirmDialog(false);
              triggerRef.current?.focus();
            }}
          />

          {/* Dialog */}
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3
              id="confirm-title"
              className="text-lg font-semibold text-slate-900 mb-2"
            >
              Are you sure?
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              This will delete ALL data from the database. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={() => {
                  setShowConfirmDialog(false);
                  triggerRef.current?.focus();
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => resetWorldMutation.mutate()}
                disabled={resetWorldMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {resetWorldMutation.isPending ? "Resetting…" : "Yes"}
              </button>
            </div>
            {resetWorldMutation.error && (
              <p className="text-sm text-red-500 mt-2">
                {resetWorldMutation.error.message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
