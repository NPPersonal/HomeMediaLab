import React from "react";
import { Label } from "../ui/label";

const KVField = (props: { label: string; value: string }) => {
  const { label, value } = props;

  return (
    <div className="flex flex-wrap space-x-1">
      <Label htmlFor="term">{`${label}:`}</Label>
      <p className="break-all">{value}</p>
    </div>
  );
};

export default KVField;
