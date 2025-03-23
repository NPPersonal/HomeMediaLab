"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";

interface PropType {
  triggerName: string;
  kvObject: { [key: string]: any };
}
const KVAccordion = (props: PropType) => {
  const { triggerName, kvObject } = props;

  return (
    <Accordion type="single" collapsible>
      {kvObject && (
        <AccordionItem value={triggerName}>
          <AccordionTrigger className="font-bold">
            {triggerName}
          </AccordionTrigger>
          <AccordionContent className="flex flex-col">
            {Object.keys(kvObject).map((key, i) => {
              if (kvObject[key].constructor.name !== "Object") {
                return (
                  <span key={`${key}-${i}`} className="flex space-x-1">
                    <Label htmlFor="term">{`${key}: `}</Label>
                    <span>{`${kvObject[key]}`}</span>
                  </span>
                );
              } else {
                return (
                  <KVAccordion
                    key={`${key}-${i}`}
                    triggerName={key}
                    kvObject={kvObject[key]}
                  />
                );
              }
            })}
          </AccordionContent>
        </AccordionItem>
      )}
    </Accordion>
  );
};

export default KVAccordion;
