"use client";

import type { JSX } from "react";

import {
  applyFormatToDom,
  DecoratorTextNode,
  type SerializedDecoratorTextNode,
} from "@lexical/extension";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import {
  $getDocument,
  $getNodeByKey,
  $getState,
  $setState,
  createState,
  type DOMExportOutput,
  type LexicalNode,
  type NodeKey,
  type Spread,
  type StateConfigValue,
  type StateValueOrUpdater,
} from "lexical";

import { DateTimePicker } from "../components/date-time-picker";

const tagToFormat = {
  b: "bold",
  i: "italic",
  mark: "highlight",
  s: "strikethrough",
  u: "underline",
} as const;

export function getDateTimeText(dateTime: Date | undefined): string {
  if (dateTime === undefined) {
    return "";
  }
  const hours = dateTime.getHours();
  const minutes = dateTime.getMinutes();
  return (
    dateTime.toDateString() +
    (hours === 0 && minutes === 0
      ? ""
      : ` ${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}`)
  );
}

export type SerializedDateTimeNode = Spread<
  { dateTime?: string },
  SerializedDecoratorTextNode
>;

const dateTimeState = createState("dateTime", {
  parse: (v) => new Date(v as string),
  unparse: (v) => v.toISOString(),
});

export class DateTimeNode extends DecoratorTextNode {
  $config() {
    return this.config("datetime", {
      extends: DecoratorTextNode,
      stateConfigs: [{ flat: true, stateConfig: dateTimeState }],
    });
  }

  getDateTime(): StateConfigValue<typeof dateTimeState> {
    return $getState(this, dateTimeState);
  }

  setDateTime(valueOrUpdater: StateValueOrUpdater<typeof dateTimeState>): this {
    return $setState(this, dateTimeState, valueOrUpdater);
  }

  getTextContent(): string {
    return getDateTimeText(this.getDateTime());
  }

  exportDOM(): DOMExportOutput {
    const element = $getDocument().createElement("span");
    const textDom = $getDocument().createTextNode(
      getDateTimeText(this.getDateTime()),
    );
    element.setAttribute(
      "data-lexical-datetime",
      this.getDateTime()?.toString() || "",
    );
    // Same chip look as the picker trigger, for read-only views.
    element.className =
      "rounded-md bg-secondary px-1.5 py-0.5 text-secondary-foreground";
    element.appendChild(applyFormatToDom(this, textDom, tagToFormat));
    return { element };
  }

  createDOM(): HTMLElement {
    const element = $getDocument().createElement("span");
    element.setAttribute(
      "data-lexical-datetime",
      this.getDateTime()?.toString() || "",
    );
    element.style.display = "inline-block";
    return element;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return (
      <DateTimeComponent
        dateTime={this.getDateTime()}
        format={this.getFormat()}
        nodeKey={this.__key}
      />
    );
  }
}

function DateTimeComponent({
  dateTime,
  format,
  nodeKey,
}: {
  dateTime: Date | undefined;
  format: number;
  nodeKey: NodeKey;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const [isNodeSelected] = useLexicalNodeSelection(nodeKey);

  return (
    <DateTimePicker
      dateTime={dateTime}
      format={format}
      selected={isNodeSelected}
      disabled={!isEditable}
      onChange={(next) => {
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isDateTimeNode(node)) {
            node.setDateTime(next);
          }
        });
      }}
    />
  );
}

export function $createDateTimeNode(dateTime: Date): DateTimeNode {
  return new DateTimeNode().setDateTime(dateTime);
}

export function $isDateTimeNode(
  node: LexicalNode | null | undefined,
): node is DateTimeNode {
  return node instanceof DateTimeNode;
}
