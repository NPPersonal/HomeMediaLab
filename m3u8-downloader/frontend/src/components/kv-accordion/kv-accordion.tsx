"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
// import { Label } from "@/components/ui/label";
import KVField from "../kv-field/kv-field";

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
          <AccordionTrigger className="font-bold text-lg">
            {triggerName}
          </AccordionTrigger>
          <AccordionContent className="flex flex-col space-x-1">
            {Object.keys(kvObject).map((key, i) => {
              // if value is not an Object and not an Array
              if (
                !(kvObject[key] instanceof Object) &&
                !(kvObject[key] instanceof Array)
              ) {
                return (
                  <KVField
                    key={`${key}-${i}`}
                    label={`${key}`}
                    value={`${kvObject[key]}`}
                  />
                );
              }
              // if value is an Object
              if (
                kvObject[key] instanceof Object &&
                !(kvObject[key] instanceof Array)
              ) {
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
