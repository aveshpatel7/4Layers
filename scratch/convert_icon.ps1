Add-Type -AssemblyName System.Drawing

$src = "C:\Users\andyk\.gemini\antigravity\brain\b4acbc51-8dc0-42be-b8c1-fe5d2b73ff6a\.user_uploaded\media__1784892448248.png"
$img = [System.Drawing.Bitmap]::FromFile($src)

# Save high-res PNG to mobile/assets/icon.png
$img.Save("c:\Users\andyk\Desktop\SmartNest\mobile\assets\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

$sizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($entry in $sizes.GetEnumerator()) {
    $folder = "c:\Users\andyk\Desktop\SmartNest\mobile\android\app\src\main\res\" + $entry.Key
    if (!(Test-Path $folder)) { New-Item -ItemType Directory -Path $folder -Force }
    
    $targetSize = $entry.Value
    $resized = New-Object System.Drawing.Bitmap($targetSize, $targetSize)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $targetSize, $targetSize)
    $g.Dispose()
    
    $p1 = Join-Path $folder "ic_launcher.png"
    $p2 = Join-Path $folder "ic_launcher_round.png"
    
    if (Test-Path $p1) { Remove-Item $p1 -Force }
    if (Test-Path $p2) { Remove-Item $p2 -Force }
    
    $resized.Save($p1, [System.Drawing.Imaging.ImageFormat]::Png)
    $resized.Save($p2, [System.Drawing.Imaging.ImageFormat]::Png)
    $resized.Dispose()
}

$img.Dispose()
Write-Host "EXACT USER LOGO SAVED TO ALL APP ICONS AND MIPMAPS SUCCESSFULLY!"
