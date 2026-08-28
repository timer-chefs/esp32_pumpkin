export function showMicrophoneMode(): void {
  getElement<HTMLElement>("microphone-section").style.display = "block";
  getElement<HTMLElement>("file-section").style.display = "none";
  getElement<HTMLButtonElement>("btn-microphone").disabled = true;
  getElement<HTMLButtonElement>("btn-file").disabled = false;
}

export function hideMicrophoneMode(): void {
  getElement<HTMLElement>("microphone-section").style.display = "none";
  getElement<HTMLButtonElement>("btn-microphone").disabled = false;
}

export function showFileMode(): void {
  getElement<HTMLElement>("file-section").style.display = "block";
  getElement<HTMLElement>("microphone-section").style.display = "none";
  getElement<HTMLButtonElement>("btn-file").disabled = true;
  getElement<HTMLButtonElement>("btn-microphone").disabled = false;
}

export function setFileStatus(html: string): void {
  getElement<HTMLElement>("file-status").innerHTML = html;
}

export function clearFileStatus(): void {
  getElement<HTMLElement>("file-status").replaceChildren();
}

export function setStreamFileEnabled(enabled: boolean): void {
  getElement<HTMLButtonElement>("btn-stream").disabled = !enabled;
}

export function setCurrentMode(mode: string): void {
  getElement<HTMLElement>("current-mode").textContent = `Current Mode: ${mode}`;
}

export function setCurrentStreamingEnabled(enabled: boolean): void {
  const element = getElement<HTMLElement>("current-streaming");
  element.hidden = !enabled;
  if (!enabled) {
    element.replaceChildren();
  }
}

export function setCurrentStreaming(description: string): void {
  const element = getElement<HTMLElement>("current-streaming");
  element.textContent = `Current Streaming: ${description}`;
  setCurrentStreamingEnabled(true);
}

export function setFolderStatus(success: boolean): void {
  const element = getElement<HTMLElement>("folder-status");
  element.textContent = success
    ? "Audio folder selected"
    : "Failed to select folder";
  element.style.color = success ? "green" : "red";
}

export function setVolumeDisplay(volume: number): void {
  getElement<HTMLElement>("volume-display").textContent =
    `${Math.round(volume * 100)}%`;
}

export function getElement<ElementType extends HTMLElement>(
  id: string,
): ElementType {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Expected element #${id} to exist`);
  }

  return element as ElementType;
}
