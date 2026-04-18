Set-Location "c:\Users\alekl\Desktop\BLOB\images"

$map = @{
    "118055762_167115291583337_5248073454275025224_n.jpg" = "product-zoshyty.jpg"
    "473080503_585873937393054_8648608272742573151_n.jpg" = "product-banky-pensly.jpg"
    "90016258_113960723565461_8000317083558608896_n.jpg"  = "product-tvaryny-planety.jpg"
    "90019586_113961093565424_6797418128314728448_n.jpg"  = "product-puzzle-80-kazka.jpg"
    "90039848_113982020229998_2527339356046229504_n.jpg"  = "product-puzzle-380-korabel.jpg"
    "90045373_113960866898780_2733951266081210368_n.jpg"  = "product-puzzle-80-piraty.jpg"
    "90057068_113982403563293_1340940333713719296_n.jpg"  = "product-puzzle-380-greek.jpg"
    "90098635_113960960232104_1184756961845968896_n.jpg"  = "product-puzzle-80-kvity.jpg"
    "90150531_114182470209953_2775523564504219648_n.jpg"  = "product-erudyt-premium.jpg"
    "90775466_118258749802325_2630937871351021568_n.jpg"  = "product-pidstavka-zelena.jpg"
    "90790608_118223906472476_7438216008948514816_n.jpg"  = "product-bicer.jpg"
    "90791897_118263246468542_1129119710680449024_n.jpg"  = "product-vitrina.jpg"
    "90794145_118258756468991_8240485508652728320_n.jpg"  = "product-kancelarska-knyha.jpg"
    "90794851_118258753135658_6079623106245165056_n.jpg"  = "product-orhanayzer.jpg"
    "90915285_118223899805810_5724185661666230272_n.jpg"  = "product-kilymova-vyshyvka.jpg"
    "90920819_118263359801864_5871689037772750848_n.jpg"  = "product-popsocket.jpg"
    "90965530_118263289801871_3993098113760886784_n.jpg"  = "product-sim.jpg"
    "91014581_118258736468993_7677371221192736768_n.jpg"  = "product-pidstavka-syna.jpg"
    "91044988_113990663562467_8089347705450528768_n.jpg"  = "product-klej.jpg"
}

foreach ($old in $map.Keys) {
    $new = $map[$old]
    if (Test-Path $old) {
        Rename-Item $old $new
        Write-Host "OK: $old -> $new"
    } else {
        Write-Host "SKIP (not found): $old"
    }
}

# subfolder
Set-Location "c:\Users\alekl\Desktop\BLOB\images\250D~1"

$map2 = @{
    "84636196_114183146876552_4404805376583663616_n.jpg"      = "product-puzzle-kruhlyy.jpg"
    "90055777_114182860209914_4984766007542284288_n.jpg"      = "product-rozmaliuvanka-fei.jpg"
    "90089363_114182646876602_6376288952785043456_n.jpg"      = "product-erudyt-velykyi.jpg"
    "90150531_114182470209953_2775523564504219648_n (1).jpg"  = "product-erudyt-premium2.jpg"
    "90528059_114182793543254_3565502723233153024_n.jpg"      = "product-rozmaliuvanka-krasotky.jpg"
    "90592878_114183056876561_3787497539675095040_n.jpg"      = "product-biznes.jpg"
}

foreach ($old in $map2.Keys) {
    $new = $map2[$old]
    if (Test-Path $old) {
        Rename-Item $old $new
        Write-Host "OK: $old -> $new"
    } else {
        Write-Host "SKIP (not found): $old"
    }
}

Write-Host "Done."
