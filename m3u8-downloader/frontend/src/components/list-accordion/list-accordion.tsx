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
  list: Array<any>;
}

const ListAccordion = (props: PropType) => {
  const { triggerName, list } = props;

  return (
    <Accordion type="single" collapsible>
      {list && (
        <AccordionItem value={triggerName}>
          <AccordionTrigger className="font-bold text-lg">
            {triggerName}
          </AccordionTrigger>
          <AccordionContent className="flex flex-col space-y-2">
            {list.map((item, i) => {
              if (
                item.constructor.name !== "Array" &&
                item.constructor.name !== "Object"
              ) {
                return (
                  <Label key={`${i}`} className="break-all" htmlFor="term">
                    {item}
                  </Label>
                );
              } else if (item.constructor.name === "Array") {
                return (
                  <ListAccordion
                    key={`${i}`}
                    triggerName={`${triggerName}-${i}`}
                    list={item}
                  />
                );
              } else {
                return null;
              }
            })}
          </AccordionContent>
        </AccordionItem>
      )}
    </Accordion>
  );
};

export default ListAccordion;
