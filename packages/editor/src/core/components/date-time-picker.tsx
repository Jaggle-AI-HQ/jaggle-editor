"use client";

import { type ChangeEvent, useState } from "react";

import { setHours, setMinutes } from "date-fns";
import {
  IS_BOLD,
  IS_HIGHLIGHT,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_UNDERLINE,
} from "lexical";

import { Calendar } from "../../ui/calendar";
import { Checkbox } from "../../ui/checkbox";
import { InputGroup, InputGroupInput } from "../../ui/input-group";
import { Label } from "../../ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../ui/popover";
import { cn } from "../../lib/utils";

import { useTranslation } from "../lib/locale";

const FORMAT_CLASSES = [
  [IS_BOLD, "font-bold"],
  [IS_HIGHLIGHT, "bg-yellow-200/70 dark:bg-yellow-500/30"],
  [IS_ITALIC, "italic"],
  [IS_STRIKETHROUGH, "line-through"],
  [IS_UNDERLINE, "underline"],
] as const;

function formatTimeValue(dateTime: Date): string {
  return `${dateTime.getHours().toString().padStart(2, "0")}:${dateTime
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

export function DateTimePicker({
  dateTime,
  format,
  selected = false,
  disabled = false,
  onChange,
}: {
  dateTime: Date | undefined;
  format: number;
  selected?: boolean;
  disabled?: boolean;
  onChange: (date: Date) => void;
}) {
  const { t, dir, language } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState(dateTime);
  const [month, setMonth] = useState<Date | undefined>(dateTime ?? new Date());
  const [includeTime, setIncludeTime] = useState(() => {
    if (dateTime === undefined) {
      return false;
    }
    return dateTime.getHours() !== 0 || dateTime.getMinutes() !== 0;
  });
  const [timeValue, setTimeValue] = useState(() => {
    if (dateTime === undefined) {
      return "00:00";
    }
    if (dateTime.getHours() !== 0 || dateTime.getMinutes() !== 0) {
      return formatTimeValue(dateTime);
    }
    return "00:00";
  });

  const commit = (next: Date) => {
    setValue(next);
    onChange(next);
  };

  const handleIncludeTimeChange = (checked: boolean) => {
    if (checked) {
      setIncludeTime(true);
      return;
    }
    if (value) {
      commit(setHours(setMinutes(value, 0), 0));
    }
    setIncludeTime(false);
    setTimeValue("00:00");
  };

  const handleTimeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const time = event.target.value;
    if (!value) {
      setTimeValue(time);
      return;
    }
    const [hours, minutes] = time.split(":").map((str) => parseInt(str, 10));
    commit(setHours(setMinutes(value, minutes), hours));
    setTimeValue(time);
  };

  const handleDaySelect = (date: Date | undefined) => {
    if (!timeValue || !date) {
      setValue(date);
      return;
    }
    const [hours, minutes] = timeValue
      .split(":")
      .map((str) => parseInt(str, 10));
    commit(
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        hours,
        minutes,
      ),
    );
  };

  return (
    <Popover
      open={isOpen && !disabled}
      onOpenChange={(nextOpen) => {
        if (!disabled) {
          setIsOpen(nextOpen);
        }
      }}
    >
      <PopoverTrigger asChild>
        <span
          className={cn(
            "cursor-pointer rounded-md bg-secondary px-1.5 py-0.5 text-secondary-foreground transition-colors hover:bg-secondary/80",
            FORMAT_CLASSES.filter(([flag]) => format & flag).map(
              ([, className]) => className,
            ),
            selected && "outline-2 outline-offset-1 outline-primary",
            disabled && "cursor-default",
          )}
        >
          {dateTime
            ? new Intl.DateTimeFormat(language, {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric",
              }).format(dateTime) + (includeTime ? " " + timeValue : "")
            : "Invalid Date"}
        </span>
      </PopoverTrigger>
      {isOpen && !disabled ? (
        <PopoverContent dir={dir} align="start" className="w-auto gap-0 p-0">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            fixedWeeks={false}
            showOutsideDays={false}
            selected={value}
            required
            month={month}
            onMonthChange={setMonth}
            onSelect={handleDaySelect}
            startMonth={new Date(1925, 0)}
            endMonth={new Date(2042, 7)}
            className="p-2.5"
          />
          <div className="w-0 min-w-full border-t p-3 space-y-3">
            <Label className="font-normal">
              <Checkbox
                checked={includeTime}
                onCheckedChange={(checked) =>
                  handleIncludeTimeChange(checked === true)
                }
              />
              {t.dateTimeTime}
            </Label>
            <InputGroup>
              <InputGroupInput
                type="time"
                value={timeValue}
                onChange={handleTimeChange}
                disabled={!includeTime}
                className="lexical-datetime-time"
              />
            </InputGroup>
          </div>
        </PopoverContent>
      ) : null}
    </Popover>
  );
}
