import React, { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface SettingTypes {
  url: string;
  filename: string;
}

interface PropType {
  url: string;
  onConfirm?: (value: SettingTypes) => void;
}

const HLSDownloadSetting = (props: PropType) => {
  const { url, onConfirm } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<SettingTypes>({
    url: url,
    filename: "output.mp4",
  });

  const onFilenameChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings((value) => {
      return { ...value, filename: e.target.value };
    });
  };

  const onConfirmClick = () => {
    if (onConfirm) onConfirm(settings);
    setIsOpen(false);
  };

  return (
    <Dialog
      defaultOpen={false}
      open={isOpen}
      onOpenChange={(value) => setIsOpen(value)}
    >
      <DialogTrigger asChild>
        <Button onClick={() => setIsOpen(true)}>{`Download`}</Button>
      </DialogTrigger>
      <DialogContent className="min-w-[90%]">
        <DialogHeader>
          <DialogTitle>{`Download setting`}</DialogTitle>
          <DialogDescription>
            {`Change setting before downloading the video`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="url" className="text-left">
              {`URL`}
            </Label>
            <p className="col-span-3 break-all">{url}</p>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="output" className="text-left">
              {`File name`}
            </Label>
            <Input
              id="filename"
              className="col-span-3"
              value={settings.filename}
              onChange={onFilenameChanged}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onConfirmClick}>{`Confirm`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default HLSDownloadSetting;
