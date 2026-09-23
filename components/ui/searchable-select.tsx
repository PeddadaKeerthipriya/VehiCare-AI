"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, Check, X, Search, Sparkles } from "lucide-react";
import { fuzzyFilter, FuzzyOption } from "@/lib/fuzzySearch";

export interface SearchableSelectProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: (string | FuzzyOption)[];
  placeholder?: string;
  searchPlaceholder?: string;
  noResultsMessage?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  allowCustom?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  noResultsMessage = "No matching vehicle found",
  disabled = false,
  error = false,
  className = "",
  allowCustom = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [hasNavigatedKeys, setHasNavigatedKeys] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const getSelectedLabel = useCallback(
    (val: string) => {
      if (!val) return "";
      const matched = options.find((opt) =>
        typeof opt === "string" ? opt === val : opt.value === val
      );
      if (matched && typeof matched !== "string" && matched.label) {
        return matched.label;
      }
      return val;
    },
    [options]
  );

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery(getSelectedLabel(value));
    }
  }, [value, isOpen, getSelectedLabel]);

  const filteredResults = useMemo(() => {
    const selectedLabel = getSelectedLabel(value);
    const activeQuery =
      isOpen && !allowCustom && (searchQuery === value || searchQuery === selectedLabel)
        ? ""
        : searchQuery;
    return fuzzyFilter(options, activeQuery);
  }, [options, searchQuery, isOpen, value, allowCustom, getSelectedLabel]);

  useEffect(() => {
    setHighlightedIndex(0);
    setHasNavigatedKeys(false);
  }, [filteredResults]);

  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        if (!allowCustom) {
          setSearchQuery(getSelectedLabel(value));
        } else {
          if (searchQuery.trim() && searchQuery !== value) {
            onChange(searchQuery.trim());
          }
        }
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [value, allowCustom, searchQuery, onChange, getSelectedLabel]);

  const handleSelect = (canonicalValue: string) => {
    onChange(canonicalValue);
    setSearchQuery(getSelectedLabel(canonicalValue));
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearchQuery("");
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleFocus = () => {
    if (!disabled) {
      setIsOpen(true);
      inputRef.current?.select();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        e.preventDefault();
        setIsOpen(true);
        return;
      }
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHasNavigatedKeys(true);
      setHighlightedIndex((prev) =>
        prev < filteredResults.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHasNavigatedKeys(true);
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredResults.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (allowCustom) {
        if (hasNavigatedKeys && filteredResults.length > 0 && filteredResults[highlightedIndex]) {
          handleSelect(filteredResults[highlightedIndex].canonicalValue);
        } else if (searchQuery.trim()) {
          onChange(searchQuery.trim());
          setIsOpen(false);
        } else if (filteredResults.length > 0) {
          handleSelect(filteredResults[0].canonicalValue);
        }
      } else {
        if (filteredResults.length > 0 && filteredResults[highlightedIndex]) {
          handleSelect(filteredResults[highlightedIndex].canonicalValue);
        }
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      if (!allowCustom) {
        setSearchQuery(getSelectedLabel(value));
      }
    } else if (e.key === "Tab") {
      setIsOpen(false);
      if (!allowCustom) {
        if (filteredResults.length > 0 && filteredResults[0].score >= 80) {
          handleSelect(filteredResults[0].canonicalValue);
        } else {
          setSearchQuery(getSelectedLabel(value));
        }
      } else {
        if (searchQuery.trim()) {
          onChange(searchQuery.trim());
        }
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      data-testid={id ? `select-${id}` : undefined}
    >
      {name && <input type="hidden" name={name} value={value} />}

      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={id ? `${id}-list` : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={searchQuery}
          onClick={() => {
            if (!disabled && !isOpen) setIsOpen(true);
          }}
          onChange={(e) => {
            const nextVal = e.target.value;
            setSearchQuery(nextVal);
            setHasNavigatedKeys(false);
            if (allowCustom) {
              onChange(nextVal);
            }
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 pr-16 text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none transition-all focus:bg-[#132020] ${
            disabled
              ? "cursor-not-allowed opacity-60 bg-[#132020] text-[#81918E]"
              : ""
          } ${
            error
              ? "border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
          }`}
        />

        <div className="absolute right-3 flex items-center gap-1.5 text-[#81918E]">
          {value && !disabled && (
            <button
              type="button"
              aria-label="Clear selection"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
              className="rounded-full p-1 hover:bg-[#132020] text-[#81918E] hover:text-[#F5F7F6] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            aria-label="Toggle dropdown"
            tabIndex={-1}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (!disabled) {
                if (isOpen) {
                  setIsOpen(false);
                  if (!allowCustom) {
                    setSearchQuery(value);
                  }
                } else {
                  setIsOpen(true);
                  inputRef.current?.focus();
                }
              }
            }}
            className={`p-1 rounded-lg transition-transform duration-200 ${
              isOpen ? "rotate-180 text-[#66C56A]" : ""
            }`}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl border border-[#203131] bg-[#0B1515] shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
          {filteredResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
              <Search className="h-5 w-5 text-[#81918E] mb-1.5 opacity-60" />
              <p className="text-xs font-medium text-[#81918E]">
                {noResultsMessage}
              </p>
              {searchQuery && (
                <div className="mt-2 flex flex-col items-center gap-1.5">
                  <p className="text-[11px] text-[#81918E]">
                    {allowCustom
                      ? `You can use "${searchQuery}" as a custom entry`
                      : `No match found for "${searchQuery}"`}
                  </p>
                  {allowCustom && searchQuery.trim() !== "" && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(searchQuery.trim());
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#66C56A] bg-[#101C1C] px-3 py-1.5 rounded-lg border border-[#2E7D32]/50 hover:bg-[#132020] transition-colors"
                    >
                      Use &quot;{searchQuery.trim()}&quot;
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <ul
              ref={listRef}
              id={id ? `${id}-list` : undefined}
              role="listbox"
              className="max-h-60 overflow-y-auto py-1 text-sm scrollbar-thin"
            >
              {filteredResults.map((result, index) => {
                const isSelected = result.canonicalValue === value;
                const isHighlighted = index === highlightedIndex;

                let displayLabel = result.canonicalValue;
                if (typeof result.item !== "string" && result.item.label) {
                  displayLabel = result.item.label;
                }

                return (
                  <li
                    key={result.canonicalValue}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(result.canonicalValue);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`flex items-center justify-between px-3.5 py-2 cursor-pointer transition-colors ${
                      isHighlighted
                        ? "bg-[#101C1C] text-[#66C56A] font-medium"
                        : "text-[#B8C4C2]"
                    } ${isSelected && !isHighlighted ? "bg-[#101C1C] font-semibold text-[#F5F7F6]" : ""}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{displayLabel}</span>
                      {result.isTypoSuggestion && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 shrink-0 border border-amber-800">
                          <Sparkles className="h-2.5 w-2.5" />
                          Suggested
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="h-4 w-4 text-[#66C56A] shrink-0 ml-2" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
