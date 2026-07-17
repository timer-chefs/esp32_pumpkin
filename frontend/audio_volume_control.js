let volume = 0.5;

export function update_volume_display()
{
    document
        .getElementById("volume-display")
        .textContent = `${Math.round(volume * 100)}%`;
}

export async function increase_volume()
{
    const response =
        await fetch("/api/audio/volume/up", {method: "POST"});
    const data = await response.json();
    volume = data.volume;

    update_volume_display();
}

export async function decrease_volume()
{
    const response = await fetch("/api/audio/volume/down",{method: "POST"});
    const data = await response.json();
    volume = data.volume;

    update_volume_display();
}

export async function load_volume()
{
    const response = await fetch("/api/audio/volume");
    const data = await response.json();
    volume = data.volume;

    update_volume_display();
}
