# Generate animated character GLB files using Blender
# Usage: pwsh scripts/generate_characters.ps1

param(
    [string]$BlenderExe = "C:\Program Files\Blender Foundation\Blender 5.0\blender.exe"
)

# Output paths
$playerOut = "$(Get-Location)/public/models/player/character.glb"
$npc1Out = "$(Get-Location)/public/models/pedestrians/npc1.glb"
$npc2Out = "$(Get-Location)/public/models/pedestrians/npc2.glb"
$npc3Out = "$(Get-Location)/public/models/pedestrians/npc3.glb"
$npc4Out = "$(Get-Location)/public/models/pedestrians/npc4.glb"

$scriptPath = "$(Get-Location)/scripts/generate_character_glb.py"

Write-Host "🎬 Generating animated character GLB files..." -ForegroundColor Green
Write-Host ""

# Generate player
Write-Host "Generating player character..."
& $BlenderExe --background --python $scriptPath -- $playerOut
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate player character" -ForegroundColor Red
    exit 1
}

# Generate NPCs (4 variants)
$npcOutputs = @($npc1Out, $npc2Out, $npc3Out, $npc4Out)
for ($i = 0; $i -lt 4; $i++) {
    Write-Host "Generating NPC $($i+1)..."
    & $BlenderExe --background --python $scriptPath -- $npcOutputs[$i]
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to generate NPC $($i+1)" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "✅ All characters generated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Generated files:"
Get-Item $playerOut, $npc1Out, $npc2Out, $npc3Out, $npc4Out -ErrorAction SilentlyContinue | 
    ForEach-Object { Write-Host "  ✓ $($_.Name) ($([math]::Round($_.Length/1MB, 2)) MB)" }

Write-Host ""
Write-Host "Next step: npm run dev"
