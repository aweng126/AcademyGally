"use client";

import { useEffect, useState } from "react";
import type { VenueEntry } from "@/lib/types";
import { getVenues } from "@/lib/api";

interface Props {
  selectedVenue: string | null;
  selectedYear: number | null;
  onSelect: (venue: string | null, year: number | null) => void;
}

export default function VenueFilter({ selectedVenue, selectedYear, onSelect }: Props) {
  const [venues, setVenues] = useState<VenueEntry[]>([]);

  useEffect(() => {
    getVenues().then(setVenues).catch(console.error);
  }, []);

  if (venues.length === 0) return null;

  const activeVenueData = venues.find((v) => v.venue === selectedVenue);

  return (
    <div className="flex flex-col gap-2">
      {/* Venue chips row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* "All" chip */}
        <button
          onClick={() => onSelect(null, null)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            !selectedVenue
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All
        </button>

        {venues.map((v) => (
          <button
            key={v.venue}
            onClick={() =>
              selectedVenue === v.venue
                ? onSelect(null, null)   // toggle off
                : onSelect(v.venue, null)
            }
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              selectedVenue === v.venue
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {v.venue}
            <span className={`ml-1.5 ${selectedVenue === v.venue ? "text-gray-300" : "text-gray-400"}`}>
              {v.total}
            </span>
          </button>
        ))}
      </div>

      {/* Year sub-chips — only show when a venue is selected AND it has year data */}
      {activeVenueData && activeVenueData.years.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pl-2 border-l-2 border-gray-200">
          <span className="text-xs text-gray-400 mr-1">Year:</span>
          {/* "All years" option */}
          <button
            onClick={() => onSelect(selectedVenue, null)}
            className={`rounded-full px-2.5 py-0.5 text-xs transition ${
              selectedYear === null
                ? "bg-gray-700 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {activeVenueData.years.map(({ year, count }) => (
            <button
              key={year}
              onClick={() =>
                selectedYear === year
                  ? onSelect(selectedVenue, null)   // toggle year off
                  : onSelect(selectedVenue, year)
              }
              className={`rounded-full px-2.5 py-0.5 text-xs transition ${
                selectedYear === year
                  ? "bg-gray-700 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {year}
              <span className="ml-1 opacity-60">{count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
