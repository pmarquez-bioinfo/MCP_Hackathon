#!/bin/bash

# Create output directory for compressed files
OUTPUT_DIR="songs_compressed"
mkdir -p "$OUTPUT_DIR"

# Counter for processed files
processed=0
failed=0
batch_size=20

echo "Starting audio compression..."
echo "Converting MP3 files to Opus format (48 kbps) in batches of $batch_size"
echo "----------------------------------------"

# Get all MP3 files into an array
mp3_files=(songs/*.mp3)

# Check if any MP3 files exist
if [ ! -f "${mp3_files[0]}" ]; then
    echo "No MP3 files found in songs directory"
    exit 1
fi

# Total number of files
total_files=${#mp3_files[@]}
echo "Found $total_files MP3 files to process"
echo "----------------------------------------"

# Process files in batches
for ((i=0; i<${#mp3_files[@]}; i+=batch_size)); do
    # Calculate batch number and range
    batch_num=$((i/batch_size + 1))
    batch_end=$((i + batch_size - 1))
    if [ $batch_end -ge $total_files ]; then
        batch_end=$((total_files - 1))
    fi
    
    echo "Processing batch $batch_num (files $((i+1)) to $((batch_end+1)))..."
    
    # Process current batch with parallel jobs
    for ((j=i; j<=batch_end && j<${#mp3_files[@]}; j++)); do
        mp3_file="${mp3_files[j]}"
        
        # Get filename without path
        filename=$(basename "$mp3_file")
        # Remove .mp3 extension and add .opus
        output_file="$OUTPUT_DIR/${filename%.mp3}.opus"
        
        # Run conversion in background
        {
            if ffmpeg -i "$mp3_file" -c:a libopus -b:a 48k -vbr on -compression_level 10 "$output_file" -y -loglevel error 2>&1; then
                echo "✓ Converted: $filename"
            else
                echo "✗ Failed: $filename"
            fi
        } &
    done
    
    # Wait for all background jobs in this batch to complete
    wait
    
    # Update counters (approximate - for accurate count we'd need job tracking)
    processed=$((batch_end + 1))
    
    echo "Batch $batch_num complete. Progress: $processed/$total_files"
    echo "----------------------------------------"
done

echo "----------------------------------------"
echo "Compression complete!"
echo "Processed: $processed files"
echo "Failed: $failed files"
echo "Output directory: $OUTPUT_DIR"

# Show size comparison
if [ $processed -gt 0 ]; then
    echo ""
    echo "Size comparison:"
    original_size=$(du -sh songs | cut -f1)
    compressed_size=$(du -sh "$OUTPUT_DIR" | cut -f1)
    echo "Original size: $original_size"
    echo "Compressed size: $compressed_size"
fi